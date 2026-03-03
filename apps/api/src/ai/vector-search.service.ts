// ---------------------------------------------------------------------------
// VectorSearchService — Hybrid search (BM25 + pgvector) with RRF & MMR
// E5b-4 Task 3 (AC: #4, #5, #6)
// Shared service — reusable by E5d (Knowledge RAG), not memory-specific
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EmbeddingService } from './embedding.service.js';
import { daysSince } from './text-utils.js';

// ─── Types ────────────────────────────────────────────────────────────────

/** Result from pgvector cosine similarity search */
export interface SimilarityResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: unknown;
}

/** Result from BM25 full-text search */
export interface KeywordResult {
  id: string;
  content: string;
  rank: number;
}

/** Fused result from hybrid search (BM25 + semantic via RRF) */
export interface HybridResult {
  id: string;
  content: string;
  rrf_score: number;
  keyword_rank?: number;
  semantic_rank?: number;
  metadata?: unknown;
}

/** Options for hybrid search */
export interface HybridSearchOpts {
  limit?: number;
  keywordWeight?: number;
  semanticWeight?: number;
  rrf_k?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Default minimum cosine similarity threshold for vector search */
const DEFAULT_MIN_SIMILARITY = 0.5;

/** Default RRF constant (standard value from the original RRF paper) */
const DEFAULT_RRF_K = 60;

/** Default keyword weight in RRF fusion */
const DEFAULT_KEYWORD_WEIGHT = 0.3;

/** Default semantic weight in RRF fusion */
const DEFAULT_SEMANTIC_WEIGHT = 0.7;

/** Default hybrid search result limit */
const DEFAULT_HYBRID_LIMIT = 50;

/** Default MMR lambda (70% relevance, 30% diversity) */
const DEFAULT_MMR_LAMBDA = 0.7;

/** Source weight multiplier for EXPLICIT memories */
const EXPLICIT_SOURCE_WEIGHT = 1.5;

/** Source weight multiplier for IMPLICIT memories */
const IMPLICIT_SOURCE_WEIGHT = 1.0;

/**
 * Allowed table names for vector/keyword search.
 * Defence-in-depth: uses a frozen Map of identifier → pre-validated SQL fragment
 * so that callers can never inject arbitrary strings into SQL, even if the
 * validation check is accidentally removed.
 */
const ALLOWED_TABLE_SQL: ReadonlyMap<string, string> = Object.freeze(
  new Map([
    ['ai_memories', 'ai_memories'],
    ['ai_knowledge_chunks', 'ai_knowledge_chunks'],
  ]),
);

/**
 * Allowed filter column names.
 * Prevents SQL injection by whitelisting valid column identifiers.
 */
const ALLOWED_FILTER_COLUMNS = new Set([
  'user_id',
  'company_id',
  'category',
  'source',
  'tenant_id',
  'knowledge_base_id',
]);

// ─── VectorSearchService ──────────────────────────────────────────────────

export class VectorSearchService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly embeddingService: EmbeddingService,
  ) {}

  // ─── Similarity Search (Task 3.2) ─────────────────────────────────────

  /**
   * Semantic similarity search via pgvector cosine distance.
   *
   * Executes raw SQL against any table with an `embedding vector(1536)` column.
   * Uses parameterised queries to prevent SQL injection.
   *
   * @param queryEmbedding - The embedding vector for the search query
   * @param table - Table name to search (must be in ALLOWED_TABLES)
   * @param filters - Column→value filters (e.g. { user_id: '...', company_id: '...' })
   * @param limit - Maximum results to return
   * @param minSimilarity - Minimum cosine similarity threshold (default: 0.5)
   */
  async similaritySearch(
    queryEmbedding: number[],
    table: string,
    filters: Record<string, unknown>,
    limit: number,
    minSimilarity: number = DEFAULT_MIN_SIMILARITY,
  ): Promise<SimilarityResult[]> {
    const tableSql = this.resolveTable(table);

    // $1 = embedding vector, $2 = min similarity threshold, $3 = limit
    // Additional filter params start at $4
    const { whereClause, params } = this.buildWhereClause(filters, 4);

    const sql = `
      SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity, metadata
      FROM ${tableSql}
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $2
        ${whereClause ? `AND ${whereClause}` : ''}
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    try {
      const rows = await this.db.$queryRawUnsafe<
        Array<{ id: string; content: string; similarity: number; metadata: unknown }>
      >(sql, embeddingStr, minSimilarity, limit, ...params);

      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        similarity: Number(row.similarity),
        metadata: row.metadata,
      }));
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message, table },
        'VectorSearchService: similaritySearch failed',
      );
      return [];
    }
  }

  // ─── BM25 Keyword Search (Task 3.3) ───────────────────────────────────

  /**
   * BM25 keyword search via PostgreSQL full-text search (tsvector/tsquery).
   *
   * @param query - The search query text
   * @param table - Table name to search (must be in ALLOWED_TABLES)
   * @param filters - Column→value filters
   * @param limit - Maximum results to return
   */
  async keywordSearch(
    query: string,
    table: string,
    filters: Record<string, unknown>,
    limit: number,
  ): Promise<KeywordResult[]> {
    const tableSql = this.resolveTable(table);

    // $1 = search query text, $2 = limit
    // Additional filter params start at $3
    const { whereClause, params } = this.buildWhereClause(filters, 3);

    const sql = `
      SELECT id, content, ts_rank_cd(search_vector, plainto_tsquery('english', $1)) AS rank
      FROM ${tableSql}
      WHERE search_vector @@ plainto_tsquery('english', $1)
        ${whereClause ? `AND ${whereClause}` : ''}
      ORDER BY rank DESC
      LIMIT $2
    `;

    try {
      const rows = await this.db.$queryRawUnsafe<
        Array<{ id: string; content: string; rank: number }>
      >(sql, query, limit, ...params);

      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        rank: Number(row.rank),
      }));
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message, table },
        'VectorSearchService: keywordSearch failed',
      );
      return [];
    }
  }

  // ─── Hybrid Search with RRF (Task 3.4) ────────────────────────────────

  /**
   * Hybrid search combining BM25 keyword search and pgvector semantic search
   * using weighted Reciprocal Rank Fusion (RRF).
   *
   * Algorithm:
   *   1. Execute keywordSearch() and similaritySearch() in parallel
   *   2. Assign rank position to each result in each list (1-indexed)
   *   3. For each unique result: score = w_kw/(k+rank_kw) + w_sem/(k+rank_sem)
   *   4. Missing ranks use (limit+1) as penalty
   *   5. Sort by fused score DESC, return top limit
   *
   * Falls back to BM25-only if query embedding cannot be generated.
   *
   * @param query - The search query text
   * @param queryEmbedding - Pre-computed embedding for the query (or null for BM25-only)
   * @param table - Table name to search
   * @param filters - Column→value filters
   * @param opts - Optional weights, limits, and RRF parameters
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[] | null,
    table: string,
    filters: Record<string, unknown>,
    opts?: HybridSearchOpts,
  ): Promise<HybridResult[]> {
    const limit = opts?.limit ?? DEFAULT_HYBRID_LIMIT;
    const keywordWeight = opts?.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
    const semanticWeight = opts?.semanticWeight ?? DEFAULT_SEMANTIC_WEIGHT;
    const rrf_k = opts?.rrf_k ?? DEFAULT_RRF_K;

    // Execute both searches in parallel (semantic only if we have an embedding)
    const [keywordResults, semanticResults] = await Promise.all([
      this.keywordSearch(query, table, filters, limit),
      queryEmbedding
        ? this.similaritySearch(queryEmbedding, table, filters, limit)
        : Promise.resolve([]),
    ]);

    // If both return empty, nothing to fuse
    if (keywordResults.length === 0 && semanticResults.length === 0) {
      return [];
    }

    // Build rank maps (1-indexed)
    const keywordRanks = new Map<string, number>();
    for (let i = 0; i < keywordResults.length; i++) {
      keywordRanks.set(keywordResults[i]!.id, i + 1);
    }

    const semanticRanks = new Map<string, number>();
    for (let i = 0; i < semanticResults.length; i++) {
      semanticRanks.set(semanticResults[i]!.id, i + 1);
    }

    // Collect all unique result IDs with their content/metadata
    const contentMap = new Map<string, { content: string; metadata?: unknown }>();
    for (const r of keywordResults) {
      contentMap.set(r.id, { content: r.content });
    }
    for (const r of semanticResults) {
      contentMap.set(r.id, { content: r.content, metadata: r.metadata });
    }

    // Penalty rank for results appearing in only one list.
    // Use the larger of the two actual result set sizes (not limit) so that
    // a short result list does not over-penalise the other search type.
    const maxResultSize = Math.max(keywordResults.length, semanticResults.length);
    const penaltyRank = maxResultSize + 1;

    // Compute RRF score for each unique result
    const fused: HybridResult[] = [];
    for (const [id, { content, metadata }] of Array.from(contentMap.entries())) {
      const kwRank = keywordRanks.get(id) ?? penaltyRank;
      const semRank = semanticRanks.get(id) ?? penaltyRank;

      const score = keywordWeight / (rrf_k + kwRank) + semanticWeight / (rrf_k + semRank);

      fused.push({
        id,
        content,
        rrf_score: score,
        keyword_rank: keywordRanks.has(id) ? kwRank : undefined,
        semantic_rank: semanticRanks.has(id) ? semRank : undefined,
        metadata,
      });
    }

    // Sort by RRF score descending
    fused.sort((a, b) => b.rrf_score - a.rrf_score);

    return fused.slice(0, limit);
  }

  // ─── MMR Re-Ranking (Task 3.5) ────────────────────────────────────────

  /**
   * Maximal Marginal Relevance (MMR) re-ranking for diversity.
   *
   * MMR(d) = λ * Sim(d, query) - (1 - λ) * max(Sim(d, selected))
   *
   * 70% weight on relevance to query, 30% penalty for similarity to
   * already-selected memories. Prevents top-N from being all about the
   * same topic.
   *
   * Candidates without embeddings are appended after MMR-ranked results.
   *
   * @param candidates - Hybrid search results to re-rank
   * @param queryEmbedding - The query embedding for relevance scoring
   * @param candidateEmbeddings - Map of candidate ID → embedding vector
   * @param limit - Maximum results to return
   * @param lambda - Balance between relevance and diversity (default: 0.7)
   */
  mmrRerank(
    candidates: HybridResult[],
    queryEmbedding: number[],
    candidateEmbeddings: Map<string, number[]>,
    limit: number,
    lambda: number = DEFAULT_MMR_LAMBDA,
  ): HybridResult[] {
    // Separate candidates with and without embeddings
    const withEmbedding: HybridResult[] = [];
    const withoutEmbedding: HybridResult[] = [];

    for (const candidate of candidates) {
      if (candidateEmbeddings.has(candidate.id)) {
        withEmbedding.push(candidate);
      } else {
        withoutEmbedding.push(candidate);
      }
    }

    const selected: HybridResult[] = [];
    const selectedEmbeddings: number[][] = [];
    const remaining = [...withEmbedding];

    while (selected.length < limit && remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;
        const candidateEmb = candidateEmbeddings.get(candidate.id)!;

        // Relevance to query
        const queryRelevance = cosineSimilarity(candidateEmb, queryEmbedding);

        // Max similarity to any already-selected result
        let maxSimToSelected = 0;
        for (const selectedEmb of selectedEmbeddings) {
          const sim = cosineSimilarity(candidateEmb, selectedEmb);
          if (sim > maxSimToSelected) maxSimToSelected = sim;
        }

        // MMR score
        const mmrScore = lambda * queryRelevance - (1 - lambda) * maxSimToSelected;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;

      const chosen = remaining[bestIdx]!;
      selected.push(chosen);
      selectedEmbeddings.push(candidateEmbeddings.get(chosen.id)!);
      remaining.splice(bestIdx, 1);
    }

    // Append candidates without embeddings after MMR-ranked results (graceful fallback)
    const remainingSlots = limit - selected.length;
    if (remainingSlots > 0 && withoutEmbedding.length > 0) {
      selected.push(...withoutEmbedding.slice(0, remainingSlots));
    }

    return selected;
  }

  // ─── Utility Functions (Task 3.6) ─────────────────────────────────────

  /**
   * Unified temporal decay formula for effective importance scoring.
   *
   * effectiveScore = baseScore * sourceWeight * 0.5^(daysSinceAccess / halfLife)
   *
   * Used across all services for consistent scoring:
   *   - MemoryInjectionService (context assembly)
   *   - MemoryPruningService (archive/delete decisions)
   *
   * @param baseScore - The memory's raw importance score
   * @param source - 'EXPLICIT' (1.5x) or 'IMPLICIT' (1.0x)
   * @param lastAccessedAt - When the memory was last accessed
   * @param halfLifeDays - Temporal decay half-life in days (default: 30)
   */
  calculateEffectiveImportance(
    baseScore: number,
    source: string,
    lastAccessedAt: Date,
    halfLifeDays: number = 30,
  ): number {
    const daysSinceAccess = daysSince(lastAccessedAt);
    const sourceWeight = source === 'EXPLICIT' ? EXPLICIT_SOURCE_WEIGHT : IMPLICIT_SOURCE_WEIGHT;
    const temporalDecay = Math.pow(0.5, daysSinceAccess / halfLifeDays);

    return baseScore * sourceWeight * temporalDecay;
  }

  /**
   * Convenience method: generate embedding + search + return best match above threshold.
   *
   * Used by SemanticDedupService to check for similar existing memories.
   *
   * @param content - Text content to search for
   * @param table - Table name to search
   * @param filters - Column→value filters (must include user_id and company_id)
   * @param threshold - Minimum cosine similarity threshold (default: 0.85)
   */
  async findSimilar(
    content: string,
    table: string,
    filters: Record<string, unknown>,
    threshold: number = 0.85,
  ): Promise<SimilarityResult | null> {
    const embedding = await this.embeddingService.generateEmbedding(content);
    if (!embedding) return null;

    const results = await this.similaritySearch(embedding, table, filters, 1, threshold);

    return results.length > 0 ? results[0]! : null;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  /**
   * Resolve a caller-provided table name to a pre-validated SQL identifier.
   * Throws if the table is not in the allowlist.
   */
  private resolveTable(table: string): string {
    const sql = ALLOWED_TABLE_SQL.get(table);
    if (!sql) {
      throw new Error(`VectorSearchService: invalid table name "${table}"`);
    }
    return sql;
  }

  /**
   * Build a parameterised WHERE clause from a filters object.
   *
   * Only allows columns in the ALLOWED_FILTER_COLUMNS set (SQL injection prevention).
   * Supports simple equality filters and `{ in: [...] }` array filters.
   *
   * @param filters - Column→value or Column→{in: values} mapping
   * @param startParamIndex - Starting $N parameter index (1-based)
   * @returns Object with the WHERE clause string and params array
   */
  private buildWhereClause(
    filters: Record<string, unknown>,
    startParamIndex: number,
  ): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = startParamIndex;

    for (const [column, value] of Object.entries(filters)) {
      // Validate column name against allowlist
      if (!ALLOWED_FILTER_COLUMNS.has(column)) {
        this.logger.warn({ column }, 'VectorSearchService: skipping disallowed filter column');
        continue;
      }

      if (
        value !== null &&
        typeof value === 'object' &&
        'in' in (value as Record<string, unknown>)
      ) {
        // Array filter: column IN ($N, $N+1, ...)
        const arr = (value as { in: unknown[] }).in;
        if (Array.isArray(arr) && arr.length > 0) {
          const placeholders = arr.map(() => `$${paramIdx++}`);
          conditions.push(`${column} IN (${placeholders.join(', ')})`);
          params.push(...arr);
        }
      } else {
        // Simple equality: column = $N
        conditions.push(`${column} = $${paramIdx++}`);
        params.push(value);
      }
    }

    return {
      whereClause: conditions.join(' AND '),
      params,
    };
  }
}

// ─── Exported Utility Functions ──────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 *
 * cosine_sim(a, b) = dot(a, b) / (||a|| * ||b||)
 *
 * Returns 0 if either vector has zero magnitude.
 * Exported for use in tests and by other services (e.g., MMR re-ranking).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// daysSince imported from text-utils.ts

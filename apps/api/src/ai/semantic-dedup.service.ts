// ---------------------------------------------------------------------------
// SemanticDedupService — Semantic deduplication for AI memories
// E5b-3 Task 6 (AC: #7)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { MemoryRecord } from './memory.service.js';
import type { SemanticDedupCheck } from './pattern-detection.service.js';
import type { VectorSearchService } from './vector-search.service.js';
import { extractKeywords, jaccardSimilarity } from './text-utils.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DedupResult {
  isDuplicate: boolean;
  existingMemory?: MemoryRecord;
  similarity: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Cosine similarity threshold for vector-based dedup (used when E5b-4 VectorSearchService is available) */
export const VECTOR_SIMILARITY_THRESHOLD = 0.85;

/** Jaccard similarity threshold for keyword-based fallback (lower due to less accuracy) */
const KEYWORD_SIMILARITY_THRESHOLD = 0.6;

/** Maximum number of existing memories to compare against */
const MAX_COMPARISON_MEMORIES = 200;

// STOP_WORDS, extractKeywords, and jaccardSimilarity imported from text-utils.ts

// ─── SemanticDedupService ─────────────────────────────────────────────────

/** Short-lived cache entry for memory comparison set */
interface MemoryCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  memories: any[];
  fetchedAt: number;
}

/** Cache TTL: 5 seconds — enough to batch multiple dedup checks within a single flush cycle */
const MEMORY_CACHE_TTL_MS = 5_000;

export class SemanticDedupService implements SemanticDedupCheck {
  /** Short-lived cache to avoid repeated findMany queries during a single flush cycle */
  private readonly memoryCache = new Map<string, MemoryCache>();

  /** Optional VectorSearchService for semantic dedup (E5b-4) */
  private vectorSearchService: VectorSearchService | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  /** Wire VectorSearchService for vector-based dedup (setter DI per E5b conventions) */
  setVectorSearchService(service: VectorSearchService): void {
    this.vectorSearchService = service;
  }

  // ─── Check Duplicate (6.1 + 6.2) ───────────────────────────────────────

  /**
   * Check if a new memory content is a semantic duplicate of any existing memory
   * for the given user+company.
   *
   * Strategy:
   *   1. Try vector-based cosine similarity via VectorSearchService (E5b-4)
   *   2. Fall back to keyword-based Jaccard similarity if pgvector not available
   *
   * @returns DedupResult with isDuplicate flag, best-matching existing memory, and similarity score
   */
  async checkDuplicate(
    userId: string,
    companyId: string,
    newContent: string,
  ): Promise<DedupResult> {
    // Try vector-based similarity first (E5b-4 — not yet implemented)
    try {
      const vectorResult = await this.tryVectorSearch(userId, companyId, newContent);
      if (vectorResult) return vectorResult;
    } catch {
      // Vector search not available — fall through to keyword-based
      this.logger.debug('Vector search not available, falling back to keyword similarity');
    }

    // Keyword-based Jaccard similarity fallback
    return this.keywordSimilarityCheck(userId, companyId, newContent);
  }

  // ─── Memory Merge (6.3) ────────────────────────────────────────────────

  /**
   * Merge new content into an existing memory.
   *
   * Rules:
   *   - If existing content is a subset of new content → replace with new content
   *   - If new content adds information → append to existing
   *   - Update lastAccessedAt and recalculate importance
   *   - Keep the higher source type (EXPLICIT > IMPLICIT)
   */
  async mergeMemories(
    existing: MemoryRecord,
    newContent: string,
    newSource?: 'EXPLICIT' | 'IMPLICIT',
  ): Promise<MemoryRecord> {
    const mergedContent = this.computeMergedContent(existing.content, newContent);

    // Determine the superior source type (EXPLICIT > IMPLICIT) — consider both existing and incoming source
    const bestSource =
      existing.source === 'EXPLICIT' || newSource === 'EXPLICIT' ? 'EXPLICIT' : 'IMPLICIT';

    // Update the existing memory in-place.
    // Ownership verification: findFirst with userId+companyId before update
    // to enforce cross-cutting companyId scoping (project-context.md mandate).
    try {
      const verified = await this.db.aiMemory.findFirst({
        where: { id: existing.id, userId: existing.userId, companyId: existing.companyId },
        select: { id: true },
      });

      if (!verified) {
        this.logger.warn(
          { memoryId: existing.id, userId: existing.userId, companyId: existing.companyId },
          'Memory ownership verification failed during merge, returning existing',
        );
        return existing;
      }

      const updated = await this.db.aiMemory.update({
        where: { id: existing.id },
        data: {
          content: mergedContent,
          source: bestSource,
          lastAccessedAt: new Date(),
        },
      });

      // Invalidate the cache since the memory set changed
      this.invalidateCache(existing.userId, existing.companyId);

      this.logger.debug(
        {
          memoryId: existing.id,
          oldLength: existing.content.length,
          newLength: mergedContent.length,
        },
        'Memory merged successfully',
      );

      return this.toRecord(updated);
    } catch (error) {
      this.logger.warn(
        { memoryId: existing.id, error: (error as Error).message },
        'Failed to merge memory, returning existing',
      );
      return existing;
    }
  }

  // ─── Vector Search (E5b-4) ─────────────────────────────────────────────

  /**
   * Attempt vector-based similarity search using VectorSearchService.
   * Returns null if VectorSearchService is not wired or search fails
   * (triggers keyword fallback per IMP-006 graceful degradation).
   *
   * Uses cosine similarity threshold of 0.85 (VECTOR_SIMILARITY_THRESHOLD).
   */
  private async tryVectorSearch(
    userId: string,
    companyId: string,
    newContent: string,
  ): Promise<DedupResult | null> {
    if (!this.vectorSearchService) return null;

    try {
      const result = await this.vectorSearchService.findSimilar(
        newContent,
        'ai_memories',
        { user_id: userId, company_id: companyId },
        VECTOR_SIMILARITY_THRESHOLD,
      );

      if (!result) return null;

      // Fetch full memory record for merge
      const existing = await this.db.aiMemory.findUnique({ where: { id: result.id } });
      if (!existing) return null;

      return {
        isDuplicate: true,
        existingMemory: this.toRecord(existing),
        similarity: result.similarity,
      };
    } catch (err) {
      this.logger.warn({ err }, 'Vector search failed in dedup, falling back to keyword');
      return null;
    }
  }

  // ─── Keyword-based Jaccard Similarity (6.2 fallback) ───────────────────

  /**
   * Check for duplicates using keyword-based Jaccard similarity.
   * This is the fallback when pgvector is not available.
   *
   * Fetches all memories for the user+company and compares
   * keyword overlap with the new content.
   *
   * Threshold: 0.6 (lower than vector's 0.85 due to less accuracy)
   */
  private async keywordSimilarityCheck(
    userId: string,
    companyId: string,
    newContent: string,
  ): Promise<DedupResult> {
    const newKeywords = this.extractKeywords(newContent);

    if (newKeywords.size === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    // Fetch existing memories for comparison (with short-lived cache to avoid
    // repeated queries during a single flush cycle with multiple facts)
    const existingMemories = await this.fetchMemoriesWithCache(userId, companyId);

    if (existingMemories.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    let bestSimilarity = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return type
    let bestMatch: any = null;

    for (const mem of existingMemories) {
      const memKeywords = this.extractKeywords(mem.content);
      const similarity = this.jaccardSimilarity(newKeywords, memKeywords);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = mem;
      }
    }

    if (bestSimilarity >= KEYWORD_SIMILARITY_THRESHOLD && bestMatch) {
      return {
        isDuplicate: true,
        existingMemory: this.toRecord(bestMatch),
        similarity: bestSimilarity,
      };
    }

    return {
      isDuplicate: false,
      similarity: bestSimilarity,
    };
  }

  // ─── Memory Fetching with Cache ──────────────────────────────────────

  /**
   * Fetch existing memories for a user+company with a short-lived cache.
   * Multiple dedup checks within a single flush cycle (e.g. pre-compaction extracting 5 facts)
   * will reuse the same query result instead of hitting the DB 5 times.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  private async fetchMemoriesWithCache(userId: string, companyId: string): Promise<any[]> {
    const cacheKey = `${userId}:${companyId}`;
    const cached = this.memoryCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < MEMORY_CACHE_TTL_MS) {
      return cached.memories;
    }

    const memories = await this.db.aiMemory.findMany({
      where: {
        userId,
        companyId,
        // Exclude archived memories (AC7)
        NOT: {
          metadata: { path: ['archived'], equals: true },
        },
      },
      orderBy: [{ importance: 'desc' }, { lastAccessedAt: 'desc' }],
      take: MAX_COMPARISON_MEMORIES,
    });

    this.memoryCache.set(cacheKey, { memories, fetchedAt: Date.now() });

    // Evict stale entries to prevent unbounded growth
    if (this.memoryCache.size > 50) {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache) {
        if (now - entry.fetchedAt >= MEMORY_CACHE_TTL_MS) {
          this.memoryCache.delete(key);
        }
      }
    }

    return memories;
  }

  /**
   * Invalidate the memory cache for a user+company (called after merge writes).
   */
  invalidateCache(userId: string, companyId: string): void {
    this.memoryCache.delete(`${userId}:${companyId}`);
  }

  // ─── Similarity Helpers (delegating to shared text-utils) ──────────────

  /** @see jaccardSimilarity from text-utils.ts */
  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    return jaccardSimilarity(setA, setB);
  }

  /** @see extractKeywords from text-utils.ts */
  private extractKeywords(text: string): Set<string> {
    return extractKeywords(text);
  }

  // ─── Merge Helpers ─────────────────────────────────────────────────────

  /**
   * Compute the merged content between existing and new text.
   *
   * Rules:
   *   - If existing is a subset of new → use new content
   *   - If new adds information not in existing → append the new info
   *   - If they're essentially the same → keep existing
   */
  private computeMergedContent(existingContent: string, newContent: string): string {
    const existingKw = this.extractKeywords(existingContent);
    const newKw = this.extractKeywords(newContent);

    // Check if existing is a subset of new (all existing keywords appear in new)
    let existingSubset = true;
    for (const word of existingKw) {
      if (!newKw.has(word)) {
        existingSubset = false;
        break;
      }
    }

    if (existingSubset) {
      // New content contains all info from existing — replace
      return newContent;
    }

    // Check if new adds any novel keywords
    const novelKeywords = new Set<string>();
    for (const word of newKw) {
      if (!existingKw.has(word)) novelKeywords.add(word);
    }

    if (novelKeywords.size === 0) {
      // No new information — keep existing
      return existingContent;
    }

    // New content adds information — append
    return `${existingContent}. Additionally: ${newContent}`;
  }

  // ─── Record Conversion ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  private toRecord(memory: any): MemoryRecord {
    return {
      id: memory.id,
      userId: memory.userId,
      companyId: memory.companyId,
      category: memory.category,
      content: memory.content,
      source: memory.source,
      importance:
        typeof memory.importance === 'number'
          ? memory.importance
          : parseFloat(String(memory.importance)),
      lastAccessedAt: memory.lastAccessedAt,
      metadata: memory.metadata,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }
}

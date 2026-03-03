// ---------------------------------------------------------------------------
// MemoryInjectionService — Assemble <user_context> block for AI sessions
// E5b-1 Task 4.1 + E5b-3 Task 4 (Conflict Resolution)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { MemoryService, MemoryRecord } from './memory.service.js';
import type { VectorSearchService, HybridResult } from './vector-search.service.js';
import type { EmbeddingService } from './embedding.service.js';
import { extractKeywords, jaccardSimilarity } from './text-utils.js';

// ─── Types ───────────────────────────────────────────────────────────────

/** Internal representation of a scored memory with all fields needed for conflict resolution */
interface ScoredMemory {
  id: string;
  category: string;
  content: string;
  source: string;
  effectiveImportance: number;
  updatedAt: Date;
}

/** Conflict pair detected during context assembly */
export interface MemoryConflict {
  winnerId: string;
  loserId: string;
  reason: 'EXPLICIT_OVER_IMPLICIT' | 'NEWER_OVER_OLDER' | 'HIGHER_IMPORTANCE';
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Token budget for the user_context block (~2000 tokens at ~4 chars/token) */
const MAX_CONTEXT_CHARS = 8000;

/** Number of recent conversation summaries to include */
const MIN_SUMMARIES = 3;
const MAX_SUMMARIES = 5;

/** Maximum entries in the lastInjectedMemories cache (prevents unbounded growth) */
const MAX_INJECTED_CACHE_ENTRIES = 200;

/** Maximum number of memories to fetch for ranking */
const MEMORY_FETCH_LIMIT = 100;

/** Keyword overlap threshold for considering two memories as potentially conflicting */
const CONFLICT_SIMILARITY_THRESHOLD = 0.7;

// STOP_WORDS, extractKeywords, and jaccardSimilarity imported from text-utils.ts

/** Category labels for the <user_context> block */
const CATEGORY_LABELS: Record<string, string> = {
  INSTRUCTION: 'INSTRUCTION',
  PREFERENCE: 'PREFERENCE',
  WORKFLOW: 'WORKFLOW',
  DECISION: 'DECISION',
  ENTITY_CONTEXT: 'CONTEXT',
};

/** Citation instructions appended when memories are injected (~100 tokens, E5b-3 Task 3.3) */
const CITATION_INSTRUCTIONS = `
When using information from user memories to inform your response, cite the source naturally.
Examples:
- "Based on your preference for Net 30 terms..."
- "Since you typically review overdue invoices first..."
- "Following your instruction to always use FIFO costing..."
Do not cite every memory — only cite when a memory directly influences your response.`.trim();

// ─── MemoryInjectionService ───────────────────────────────────────────────

export class MemoryInjectionService {
  /** Cache of the most recently injected memory records, keyed by userId:companyId */
  private lastInjectedMemories = new Map<string, MemoryRecord[]>();

  /** Optional VectorSearchService for hybrid retrieval (E5b-4 Task 7) */
  private vectorSearchService: VectorSearchService | null = null;

  /** Optional EmbeddingService for query embedding generation (E5b-4 Task 7) */
  private embeddingService: EmbeddingService | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly memoryService: MemoryService,
    private readonly logger: Logger,
  ) {}

  /** Set the VectorSearchService instance (called during plugin initialization, E5b-4) */
  setVectorSearchService(service: VectorSearchService): void {
    this.vectorSearchService = service;
  }

  /** Set the EmbeddingService instance (called during plugin initialization, E5b-4) */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
  }

  /**
   * Retrieve the last set of memories that were injected for a user+company.
   * Used by the orchestrator to avoid a redundant DB fetch during citation tracking.
   * Returns empty array if no memories were injected or if the cache has been cleared.
   */
  getLastInjectedMemories(userId: string, companyId: string): MemoryRecord[] {
    return this.lastInjectedMemories.get(`${userId}:${companyId}`) ?? [];
  }

  /**
   * Assemble a `<user_context>` block for injection into the AI system prompt.
   *
   * Steps:
   *   1. Check AiMemorySettings.isEnabled — if false, return empty string
   *   2. Fetch active memories for user+company, filtered by enabledCategories
   *   3. Apply temporal decay to importance scores
   *   4. Sort by effective importance DESC
   *   5. Fetch 3-5 most recent conversation summaries
   *   6. Assemble into formatted <user_context> block
   *   7. Truncate to ~2000 token budget (~8000 chars)
   *
   * Returns empty string if memory is disabled or no data exists.
   * Never throws — returns empty string on any error (IMP-006 graceful degradation).
   */
  async assembleUserContext(
    userId: string,
    companyId: string,
    recentMessages?: string[],
  ): Promise<string> {
    try {
      // 1. Check memory settings
      const settings = await this.db.aiMemorySettings.findUnique({
        where: {
          userId_companyId: { userId, companyId },
        },
        select: {
          isEnabled: true,
          enabledCategories: true,
          decayHalfLifeDays: true,
        },
      });

      // If settings exist and memory is disabled, return empty
      if (settings && !settings.isEnabled) {
        return '';
      }

      const enabledCategories = settings?.enabledCategories ?? [
        'PREFERENCE',
        'WORKFLOW',
        'ENTITY_CONTEXT',
        'DECISION',
        'INSTRUCTION',
      ];

      const halfLifeDays = settings?.decayHalfLifeDays ?? 30;

      // 2. Fetch and score memories — hybrid or Prisma-based path
      let usedHybridPath = false;
      let scored: ScoredMemory[];
      let memories: Array<{
        id: string;
        userId: string;
        companyId: string;
        category: string;
        content: string;
        source: string;
        importance: number | unknown;
        lastAccessedAt: Date;
        metadata: unknown;
        createdAt: Date;
        updatedAt: Date;
      }>;

      if (
        this.vectorSearchService &&
        this.embeddingService &&
        recentMessages &&
        recentMessages.length > 0
      ) {
        // ── Hybrid retrieval path (E5b-4 Task 7.2) ──
        const result = await this.hybridRetrieve(
          userId,
          companyId,
          enabledCategories,
          recentMessages,
          halfLifeDays,
        );
        scored = result.scored;
        memories = result.memories;
        usedHybridPath = true;
      } else {
        // ── Prisma-based fallback (existing E5b-1 behaviour) ──
        const result = await this.prismaRetrieve(
          userId,
          companyId,
          enabledCategories,
          halfLifeDays,
        );
        scored = result.scored;
        memories = result.memories;
      }

      // 4. Resolve conflicts: remove losing memories from context (E5b-3 Task 4)
      const { resolved, conflicts } = this.resolveConflicts(scored);

      // 4a. Mark conflicting implicit memories in background (Task 4.2)
      if (conflicts.length > 0) {
        this.markConflictingMemories(conflicts).catch((err) => {
          this.logger.warn(
            { error: (err as Error).message, conflictCount: conflicts.length },
            'Failed to mark conflicting memories — continuing without marking',
          );
        });
      }

      // 4b. Sort resolved set by effective importance descending.
      // Skip re-sort when hybrid path was used — MMR already ordered by
      // relevance+diversity, and re-sorting would destroy that ordering.
      if (!usedHybridPath) {
        resolved.sort((a, b) => b.effectiveImportance - a.effectiveImportance);
      }

      // 5. Fetch recent conversation summaries
      const summaries = await this.db.aiConversationSummary.findMany({
        where: { userId, companyId },
        orderBy: { createdAt: 'desc' },
        take: MAX_SUMMARIES,
        select: {
          summary: true,
          topics: true,
          createdAt: true,
        },
      });

      // 6. Check if there's any data to assemble
      if (resolved.length === 0 && summaries.length === 0) {
        return '';
      }

      // 7. Assemble the <user_context> block within token budget
      const { contextBlock, includedMemoryIds } = this.buildContextBlock(resolved, summaries);

      // 7a. Cache the included memories for citation tracking (avoids redundant DB fetch)
      const includedIdSet = new Set(includedMemoryIds);
      const injectedRecords: MemoryRecord[] = memories
        .filter((m) => includedIdSet.has(m.id))
        .map((m) => ({
          id: m.id,
          userId: m.userId,
          companyId: m.companyId,
          category: m.category,
          content: m.content,
          source: m.source,
          importance:
            typeof m.importance === 'number' ? m.importance : parseFloat(String(m.importance)),
          lastAccessedAt: m.lastAccessedAt,
          metadata: m.metadata,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }));
      const cacheKey = `${userId}:${companyId}`;
      // LRU refresh: delete then re-insert so the key moves to the end of insertion order
      this.lastInjectedMemories.delete(cacheKey);
      this.lastInjectedMemories.set(cacheKey, injectedRecords);
      // Evict oldest entries if cache exceeds limit (Map preserves insertion order)
      while (this.lastInjectedMemories.size > MAX_INJECTED_CACHE_ENTRIES) {
        const oldestKey = this.lastInjectedMemories.keys().next().value;
        if (oldestKey !== undefined) this.lastInjectedMemories.delete(oldestKey);
        else break;
      }

      // 8. Touch included memories to update lastAccessedAt (AC-10)
      // Fire-and-forget — failures logged but don't block the session
      if (includedMemoryIds.length > 0) {
        for (const memId of includedMemoryIds) {
          this.memoryService.touchMemory(memId).catch(() => {
            // Swallowed — touchMemory already logs internally
          });
        }
      }

      return contextBlock;
    } catch (error) {
      // Graceful degradation — never break AI session due to memory failure
      this.logger.warn(
        { error: (error as Error).message, userId, companyId },
        'Memory injection failed, proceeding without user context',
      );
      return '';
    }
  }

  // ─── Retrieval Paths (E5b-4 Task 7.2) ────────────────────────────────

  /**
   * Hybrid retrieval path — uses VectorSearchService for BM25 + semantic search
   * with RRF fusion, temporal decay, and MMR re-ranking.
   *
   * Falls back to Prisma-based retrieval if hybrid search fails.
   */
  private async hybridRetrieve(
    userId: string,
    companyId: string,
    enabledCategories: string[],
    recentMessages: string[],
    halfLifeDays: number,
  ): Promise<{
    scored: ScoredMemory[];
    memories: Array<{
      id: string;
      userId: string;
      companyId: string;
      category: string;
      content: string;
      source: string;
      importance: number | unknown;
      lastAccessedAt: Date;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    try {
      // 1. Extract query from recent user messages (last 2-3)
      const query = recentMessages.slice(-3).join(' ');

      // 2. Generate query embedding
      const queryEmbedding = await this.embeddingService!.generateEmbedding(query);

      // 3. Build filters for hybrid search
      const filters: Record<string, unknown> = {
        user_id: userId,
        company_id: companyId,
        category: { in: enabledCategories },
      };

      // 4. Execute hybrid search (BM25 + pgvector + RRF fusion)
      const hybridResults = await this.vectorSearchService!.hybridSearch(
        query,
        queryEmbedding,
        'ai_memories',
        filters,
        { limit: MEMORY_FETCH_LIMIT },
      );

      if (hybridResults.length === 0) {
        // No results from hybrid — fall back to Prisma
        return this.prismaRetrieve(userId, companyId, enabledCategories, halfLifeDays);
      }

      // 5. Fetch full memory records for hybrid results (need all fields for conflict resolution + formatting)
      // Exclude archived memories (AC7)
      const hybridIds = hybridResults.map((r) => r.id);
      const fullMemories = await this.db.aiMemory.findMany({
        where: {
          id: { in: hybridIds },
          NOT: {
            metadata: { path: ['archived'], equals: true },
          },
        },
      });

      // Build lookup map for quick access
      const memoryMap = new Map(fullMemories.map((m) => [m.id, m]));

      // 6. Apply temporal decay to the memory's importance score (not the RRF rank score)
      // per AC6: effectiveScore = baseScore * sourceWeight * 0.5^(daysSinceAccess/halfLife)
      const decayedResults: Array<HybridResult & { effectiveImportance: number }> = [];
      for (const hr of hybridResults) {
        const mem = memoryMap.get(hr.id);
        if (!mem) continue;

        const importance =
          typeof mem.importance === 'number' ? mem.importance : parseFloat(String(mem.importance));

        const effectiveImportance = this.vectorSearchService!.calculateEffectiveImportance(
          importance,
          mem.source,
          mem.lastAccessedAt,
          halfLifeDays,
        );

        decayedResults.push({ ...hr, effectiveImportance });
      }

      // 7. Apply MMR re-ranking for diversity (if query embedding is available)
      let rankedIds: string[];
      if (queryEmbedding) {
        // Fetch embeddings for MMR candidates via raw SQL
        const candidateEmbeddings = await this.fetchCandidateEmbeddings(hybridIds);

        const mmrRanked = this.vectorSearchService!.mmrRerank(
          decayedResults,
          queryEmbedding,
          candidateEmbeddings,
          MEMORY_FETCH_LIMIT,
        );
        rankedIds = mmrRanked.map((r) => r.id);
      } else {
        // No embedding — sort by decayed score
        decayedResults.sort((a, b) => b.effectiveImportance - a.effectiveImportance);
        rankedIds = decayedResults.map((r) => r.id);
      }

      // 8. Build scored memories in MMR-ranked order
      // Index decayed results by ID for O(1) lookup (avoids O(n²) .find())
      const decayedMap = new Map(decayedResults.map((d) => [d.id, d]));
      const scored: ScoredMemory[] = [];
      const orderedMemories: typeof fullMemories = [];
      for (const id of rankedIds) {
        const mem = memoryMap.get(id);
        if (!mem) continue;

        const decayed = decayedMap.get(id);
        scored.push({
          id: mem.id,
          category: mem.category,
          content: mem.content,
          source: mem.source,
          updatedAt: mem.updatedAt,
          effectiveImportance: decayed?.effectiveImportance ?? 0,
        });
        orderedMemories.push(mem);
      }

      return { scored, memories: orderedMemories };
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message, userId, companyId },
        'Hybrid retrieval failed, falling back to Prisma-based fetch',
      );
      return this.prismaRetrieve(userId, companyId, enabledCategories, halfLifeDays);
    }
  }

  /**
   * Prisma-based fallback retrieval — existing E5b-1 behaviour.
   * Used when VectorSearchService is unavailable or hybrid search fails.
   */
  private async prismaRetrieve(
    userId: string,
    companyId: string,
    enabledCategories: string[],
    halfLifeDays: number,
  ): Promise<{
    scored: ScoredMemory[];
    memories: Array<{
      id: string;
      userId: string;
      companyId: string;
      category: string;
      content: string;
      source: string;
      importance: number | unknown;
      lastAccessedAt: Date;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    const memories = await this.db.aiMemory.findMany({
      where: {
        userId,
        companyId,
        category: { in: enabledCategories },
        // Exclude archived memories (AC7)
        NOT: {
          metadata: { path: ['archived'], equals: true },
        },
      },
      orderBy: [{ importance: 'desc' }, { lastAccessedAt: 'desc' }],
      take: MEMORY_FETCH_LIMIT,
    });

    const scored: ScoredMemory[] = memories.map((m) => ({
      category: m.category,
      content: m.content,
      id: m.id,
      source: m.source,
      updatedAt: m.updatedAt,
      effectiveImportance: this.memoryService.calculateEffectiveImportance(
        {
          importance:
            typeof m.importance === 'number' ? m.importance : parseFloat(String(m.importance)),
          source: m.source,
          lastAccessedAt: m.lastAccessedAt,
        },
        halfLifeDays,
      ),
    }));

    return { scored, memories };
  }

  /**
   * Fetch embedding vectors for a set of memory IDs via raw SQL.
   * Returns a Map of id → embedding for use in MMR re-ranking.
   * Memories without embeddings are excluded from the map.
   */
  private async fetchCandidateEmbeddings(memoryIds: string[]): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (memoryIds.length === 0) return result;

    try {
      // Fetch embeddings via raw SQL (Prisma doesn't support vector type)
      const rows = await this.db.$queryRawUnsafe<Array<{ id: string; embedding: string }>>(
        `SELECT id, embedding::text FROM ai_memories WHERE id = ANY($1) AND embedding IS NOT NULL`,
        memoryIds,
      );

      for (const row of rows) {
        try {
          // Parse pgvector's text format "[0.1,0.2,...]" to number[].
          // Strip leading/trailing brackets and split on commas — does not
          // rely on the output being valid JSON (pgvector only guarantees
          // comma-separated floats inside square brackets).
          const trimmed = row.embedding.replace(/^\[|\]$/g, '');
          const parsed = trimmed.split(',').map(Number);
          if (parsed.length > 0 && parsed.every((n) => !Number.isNaN(n))) {
            result.set(row.id, parsed);
          } else {
            this.logger.debug(
              { memoryId: row.id },
              'Embedding vector contains NaN values — excluding from MMR',
            );
          }
        } catch {
          // Skip malformed embeddings — the memory will be excluded from MMR
          // but still appear in results (appended after MMR-ranked candidates)
          this.logger.debug(
            { memoryId: row.id },
            'Failed to parse embedding vector — excluding from MMR',
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'Failed to fetch candidate embeddings for MMR — skipping MMR re-ranking',
      );
    }

    return result;
  }

  // ─── Conflict Resolution (E5b-3 Task 4) ─────────────────────────────

  /**
   * Detect and resolve conflicting memories.
   *
   * Two memories conflict when they share the same category AND have
   * keyword similarity > 0.7 but different content (i.e. they address
   * the same topic but give different instructions).
   *
   * Resolution rules (applied in order):
   *   1. Explicit > Implicit — EXPLICIT source always wins
   *   2. Newer > Older — if same source type, the more recently updated wins
   *   3. Higher importance > Lower — if same source and similar age, higher importance wins
   */
  resolveConflicts(memories: ScoredMemory[]): {
    resolved: ScoredMemory[];
    conflicts: MemoryConflict[];
  } {
    if (memories.length <= 1) {
      return { resolved: [...memories], conflicts: [] };
    }

    const conflicts: MemoryConflict[] = [];
    const excludedIds = new Set<string>();

    // Bucket by category first — conflicts can only occur within the same category,
    // so we avoid O(n^2) cross-category comparisons
    const buckets = new Map<string, ScoredMemory[]>();
    for (const mem of memories) {
      const bucket = buckets.get(mem.category);
      if (bucket) {
        bucket.push(mem);
      } else {
        buckets.set(mem.category, [mem]);
      }
    }

    // Compare pairs only within each category bucket
    for (const bucket of buckets.values()) {
      if (bucket.length <= 1) continue;

      for (let i = 0; i < bucket.length; i++) {
        const memI = bucket[i]!;
        if (excludedIds.has(memI.id)) continue;

        for (let j = i + 1; j < bucket.length; j++) {
          const memJ = bucket[j]!;
          if (excludedIds.has(memJ.id)) continue;

          // Check if they address the same topic (keyword similarity > 0.7)
          const similarity = this.keywordSimilarity(memI.content, memJ.content);
          if (similarity <= CONFLICT_SIMILARITY_THRESHOLD) continue;

          // Same topic but different content → conflict
          if (memI.content.trim().toLowerCase() === memJ.content.trim().toLowerCase()) continue;

          // Resolve the conflict
          const conflict = this.pickWinner(memI, memJ);
          conflicts.push(conflict);
          excludedIds.add(conflict.loserId);
        }
      }
    }

    const resolved = memories.filter((m) => !excludedIds.has(m.id));
    return { resolved, conflicts };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  /**
   * Determine the winner between two conflicting memories.
   */
  private pickWinner(a: ScoredMemory, b: ScoredMemory): MemoryConflict {
    // Rule 1: Explicit > Implicit
    if (a.source === 'EXPLICIT' && b.source !== 'EXPLICIT') {
      return { winnerId: a.id, loserId: b.id, reason: 'EXPLICIT_OVER_IMPLICIT' };
    }
    if (b.source === 'EXPLICIT' && a.source !== 'EXPLICIT') {
      return { winnerId: b.id, loserId: a.id, reason: 'EXPLICIT_OVER_IMPLICIT' };
    }

    // Rule 2: Newer > Older (same source type)
    const timeDiffMs = Math.abs(a.updatedAt.getTime() - b.updatedAt.getTime());
    // Only apply if the time difference is meaningful (> 1 minute)
    if (timeDiffMs > 60_000) {
      if (a.updatedAt > b.updatedAt) {
        return { winnerId: a.id, loserId: b.id, reason: 'NEWER_OVER_OLDER' };
      }
      return { winnerId: b.id, loserId: a.id, reason: 'NEWER_OVER_OLDER' };
    }

    // Rule 3: Higher importance wins
    if (a.effectiveImportance >= b.effectiveImportance) {
      return { winnerId: a.id, loserId: b.id, reason: 'HIGHER_IMPORTANCE' };
    }
    return { winnerId: b.id, loserId: a.id, reason: 'HIGHER_IMPORTANCE' };
  }

  /**
   * Calculate keyword-based Jaccard similarity between two texts.
   * Delegates to shared text-utils for consistent keyword extraction.
   */
  private keywordSimilarity(textA: string, textB: string): number {
    return jaccardSimilarity(extractKeywords(textA), extractKeywords(textB));
  }

  /**
   * Mark conflicting implicit memories with metadata so they are flagged
   * for potential cleanup by the pruning service. (E5b-3 Task 4.2)
   *
   * Fire-and-forget — failures are logged but never block context assembly.
   */
  private async markConflictingMemories(conflicts: MemoryConflict[]): Promise<void> {
    const now = new Date().toISOString();

    for (const conflict of conflicts) {
      try {
        // Fetch the losing memory to merge its existing metadata
        const existing = await this.db.aiMemory.findUnique({
          where: { id: conflict.loserId },
          select: { metadata: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Json field
        const existingMeta: Record<string, unknown> = (existing?.metadata as any) ?? {};

        await this.db.aiMemory.update({
          where: { id: conflict.loserId },
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
            metadata: {
              ...existingMeta,
              conflictsWith: conflict.winnerId,
              conflictDetectedAt: now,
            } as any,
          },
        });

        this.logger.debug(
          { loserId: conflict.loserId, winnerId: conflict.winnerId, reason: conflict.reason },
          'Marked conflicting memory',
        );
      } catch (err) {
        this.logger.warn(
          { loserId: conflict.loserId, error: (err as Error).message },
          'Failed to mark conflicting memory',
        );
      }
    }
  }

  /**
   * Build the formatted <user_context> block, truncating to token budget.
   * Returns the assembled block and the IDs of memories that were included.
   */
  private buildContextBlock(
    memories: Array<{ category: string; content: string; id: string; effectiveImportance: number }>,
    summaries: Array<{ summary: string; topics: string[]; createdAt: Date }>,
  ): { contextBlock: string; includedMemoryIds: string[] } {
    const parts: string[] = [];
    const includedMemoryIds: string[] = [];
    let charCount = 0;

    // Header
    const header = '<user_context>';
    const footer = '</user_context>';
    // Reserve space for header, footer, section headers
    const reservedChars = header.length + footer.length + 100;
    const budget = MAX_CONTEXT_CHARS - reservedChars;

    parts.push(header);

    // Memories section
    if (memories.length > 0) {
      parts.push('\n## Your Memories About This User');

      for (const mem of memories) {
        const label = CATEGORY_LABELS[mem.category] ?? mem.category;
        const line = `\n- [${label}] ${mem.content}`;

        if (charCount + line.length > budget) break;

        parts.push(line);
        charCount += line.length;
        includedMemoryIds.push(mem.id);
      }
    }

    // Summaries section
    if (summaries.length >= MIN_SUMMARIES || (summaries.length > 0 && memories.length === 0)) {
      parts.push('\n\n## Recent Conversation Summaries');

      for (const sum of summaries) {
        const dateStr = sum.createdAt.toISOString().split('T')[0];
        const line = `\n- ${dateStr}: ${sum.summary}`;

        if (charCount + line.length > budget) break;

        parts.push(line);
        charCount += line.length;
      }
    }

    // Citation instructions — only add when at least 1 memory was included (E5b-3 Task 3.3)
    if (includedMemoryIds.length > 0) {
      const citationBlock = '\n\n## Citation Guidelines\n' + CITATION_INSTRUCTIONS;
      if (charCount + citationBlock.length <= budget) {
        parts.push(citationBlock);
        charCount += citationBlock.length;
      }
    }

    parts.push('\n' + footer);

    return { contextBlock: parts.join(''), includedMemoryIds };
  }
}

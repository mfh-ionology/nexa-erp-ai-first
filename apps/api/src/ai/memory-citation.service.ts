// ---------------------------------------------------------------------------
// MemoryCitationService — Citation context injection + memory access tracking
// E5b-3 Task 3
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import type { MemoryService, MemoryRecord } from './memory.service.js';

// ─── MemoryCitationService ────────────────────────────────────────────────
// Note: Citation instructions are injected by MemoryInjectionService.buildContextBlock(),
// which is the sole authority for <user_context> assembly. This service handles
// citation *detection* and memory access *tracking* only.

export class MemoryCitationService {
  constructor(
    private readonly logger: Logger,
    private readonly memoryService: MemoryService,
  ) {}

  /**
   * Track memory access by updating `lastAccessedAt` for cited memories.
   *
   * Called by the orchestrator after the AI response is generated.
   * Uses a lightweight heuristic: checks if the response text contains keywords
   * from any injected memory's content (fuzzy match, not exact).
   *
   * Fire-and-forget — failures are logged but never throw.
   */
  async trackMemoryAccess(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    const promises = memoryIds.map((id) =>
      this.memoryService.touchMemory(id).catch(() => {
        // Swallowed — touchMemory already logs internally
      }),
    );

    await Promise.all(promises);

    this.logger.debug({ count: memoryIds.length }, 'Memory access tracked for cited memories');
  }

  /**
   * Detect which injected memories were likely cited in the AI response.
   *
   * Uses a lightweight keyword overlap heuristic:
   * - Extracts significant keywords (3+ chars) from each memory's content
   * - Checks if 2+ keywords appear in the AI response text
   * - Returns memory IDs that pass the heuristic threshold
   *
   * This is intentionally loose — false positives are acceptable
   * (updating lastAccessedAt unnecessarily is harmless).
   */
  detectCitedMemories(injectedMemories: MemoryRecord[], aiResponse: string): string[] {
    if (!aiResponse || injectedMemories.length === 0) return [];

    const responseLower = aiResponse.toLowerCase();
    const citedIds: string[] = [];

    for (const memory of injectedMemories) {
      const keywords = this.extractKeywords(memory.content);
      if (keywords.length === 0) continue;

      // Count how many keywords from this memory appear in the response
      const matchCount = keywords.filter((kw) => responseLower.includes(kw)).length;

      // Threshold: at least 2 keywords or 50% of keywords (whichever is lower)
      const threshold = Math.min(2, Math.ceil(keywords.length * 0.5));
      if (matchCount >= threshold) {
        citedIds.push(memory.id);
      }
    }

    return citedIds;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  /**
   * Extract significant keywords from memory content for fuzzy matching.
   * Filters out common stop words and short tokens.
   */
  private extractKeywords(content: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'need',
      'must',
      'ought',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'about',
      'like',
      'through',
      'after',
      'over',
      'between',
      'out',
      'against',
      'during',
      'without',
      'before',
      'under',
      'around',
      'among',
      'and',
      'but',
      'or',
      'nor',
      'not',
      'so',
      'yet',
      'both',
      'either',
      'neither',
      'each',
      'every',
      'all',
      'any',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'because',
      'that',
      'this',
      'these',
      'those',
      'what',
      'which',
      'who',
      'whom',
      'how',
      'when',
      'where',
      'why',
      'user',
      'prefers',
      'prefer',
      'uses',
      'use',
      'always',
      'never',
      'typically',
      'usually',
      'often',
      'frequently',
      'i',
      'me',
      'my',
    ]);

    return content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !stopWords.has(word));
  }
}

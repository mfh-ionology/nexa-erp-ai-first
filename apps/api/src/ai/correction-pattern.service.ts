// ---------------------------------------------------------------------------
// CorrectionPatternService — Detects correction patterns and auto-generates
// knowledge articles when threshold is met (E5d-2 Task 2, AC #3)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';
import type { KnowledgeArticleService } from './knowledge-article.service.js';
import type { CorrectionRecord } from './correction-capture.service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum corrections on the same topic before auto-generating an article */
const PATTERN_THRESHOLD = 3;

/** Window for grouping corrections (90 days in ms) */
const LOOKBACK_DAYS = 90;

/** Maximum topic length for grouping key */
const TOPIC_MAX_LENGTH = 100;

/** Mapping from correctionType to knowledge article category */
export const CORRECTION_TO_CATEGORY: Record<string, string> = {
  TERMINOLOGY: 'TERMINOLOGY',
  PROCESS: 'BUSINESS_PROCESS',
  DATA: 'CUSTOM_FIELDS',
  PREFERENCE: 'BUSINESS_PROCESS',
  OTHER: 'BUSINESS_PROCESS',
};

/** Confidence increment when an existing article is found (capped at 0.8) */
const CONFIDENCE_INCREMENT = 0.1;
const CONFIDENCE_CAP = 0.8;

// ─── Topic Extraction ─────────────────────────────────────────────────────────

/**
 * Extract a grouping topic from the corrected response.
 * Normalise: lowercase, strip punctuation, split into sorted unique words.
 * Sorting makes the topic order-invariant — "use vat code 3" and "vat code 3 use"
 * produce the same topic key, improving pattern detection accuracy.
 * Exposed as a pure function for unit testing.
 */
export function extractTopic(correctedResponse: string): string {
  const words = correctedResponse
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Sort and deduplicate for order-invariant matching
  const unique = [...new Set(words)].sort();

  // Cap at 15 words then truncate to TOPIC_MAX_LENGTH to prevent unbounded keys
  return unique.slice(0, 15).join(' ').slice(0, TOPIC_MAX_LENGTH);
}

// ─── CorrectionPatternService ─────────────────────────────────────────────────

export class CorrectionPatternService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly knowledgeArticleService: KnowledgeArticleService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Check if a newly logged correction forms a pattern and auto-generate
   * a knowledge article when the threshold is met.
   * Called from event handler — async, fire-and-forget, never blocks the caller.
   */
  async checkAndGenerateArticle(correction: CorrectionRecord): Promise<void> {
    const topic = extractTopic(correction.correctedResponse);
    if (!topic) {
      this.logger.debug({ correctionId: correction.id }, 'Empty topic — skipping pattern check');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);

    // Find matching corrections: same company, same correctionType, within lookback window,
    // not already auto-resolved, with similar topic (first 100 chars of correctedResponse)
    const matchingCorrections = await this.db.aiCorrectionLog.findMany({
      where: {
        companyId: correction.companyId,
        correctionType: correction.correctionType,
        wasAutoResolved: false,
        createdAt: { gte: cutoffDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Cap to prevent unbounded queries; well above PATTERN_THRESHOLD
    });

    // Group by topic — filter to those whose topic matches
    const topicMatches = matchingCorrections.filter(
      (c) => extractTopic(c.correctedResponse) === topic,
    );

    if (topicMatches.length < PATTERN_THRESHOLD) {
      this.logger.debug(
        {
          correctionId: correction.id,
          topic,
          matchCount: topicMatches.length,
          threshold: PATTERN_THRESHOLD,
        },
        'Below pattern threshold — no article generated',
      );
      return;
    }

    // Check for existing correction-derived article with similar topic
    const existingArticle = await this.findExistingArticle(correction.companyId, topic);

    if (existingArticle) {
      // Increment confidence instead of creating new article
      const newConfidence = Math.min(
        parseFloat(String(existingArticle.confidenceScore)) + CONFIDENCE_INCREMENT,
        CONFIDENCE_CAP,
      );

      await this.knowledgeArticleService.updateArticle(existingArticle.id, correction.companyId, {
        confidenceScore: newConfidence,
      });

      this.logger.info(
        {
          articleId: existingArticle.id,
          companyId: correction.companyId,
          oldConfidence: existingArticle.confidenceScore,
          newConfidence,
          topic,
        },
        'Existing correction-derived article found — confidence incremented',
      );

      // Mark source corrections as auto-resolved
      await this.markCorrectionsResolved(topicMatches.map((c) => c.id));
      return;
    }

    // No existing article — generate a new one
    await this.generateArticle(correction, topicMatches, topic);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Find an existing correction-derived article with similar topic in the same company.
   */
  private async findExistingArticle(companyId: string, topic: string) {
    // DB-level filter: search for existing CORRECTION_DERIVED articles whose
    // title matches the auto-generated pattern (case-insensitive via Prisma).
    // Topic is a sorted word set, so title matching is the reliable mechanism.
    // ISSUE #8 FIX: Use full topic (up to 100 chars from extractTopic) to reduce
    // collision risk — slicing to 80 caused distinct topics to match the same title.
    const expectedTitle = `Auto-learned: ${topic}`;
    const articles = await this.db.aiKnowledgeArticle.findMany({
      where: {
        companyId,
        source: 'CORRECTION_DERIVED',
        isActive: true,
        title: { equals: expectedTitle, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    return articles[0] ?? null;
  }

  /**
   * Generate a new knowledge article from a pattern of corrections.
   */
  private async generateArticle(
    correction: CorrectionRecord,
    topicMatches: Array<{ id: string; correctedResponse: string }>,
    topic: string,
  ): Promise<void> {
    const category = CORRECTION_TO_CATEGORY[correction.correctionType] ?? 'BUSINESS_PROCESS';

    // Synthesise title and content from the matching corrections
    const title = `Auto-learned: ${topic}`;
    const distinctResponses = [...new Set(topicMatches.map((c) => c.correctedResponse))];
    const content = distinctResponses.join('\n\n---\n\n');

    // Create the knowledge article via KnowledgeArticleService
    const article = await this.knowledgeArticleService.createArticle(
      correction.companyId,
      correction.userId,
      {
        title,
        content,
        category,
        source: 'CORRECTION_DERIVED',
        confidenceScore: 0.5,
        isConfirmed: false,
      },
    );

    this.logger.info(
      {
        articleId: article.id,
        companyId: correction.companyId,
        topic,
        correctionCount: topicMatches.length,
        category,
      },
      'Auto-generated knowledge article from correction pattern',
    );

    // Mark source corrections as auto-resolved
    await this.markCorrectionsResolved(topicMatches.map((c) => c.id));

    // Emit event
    this.eventBus.emit('ai.correction.autoArticleGenerated', {
      articleId: article.id,
      companyId: correction.companyId,
      correctionCount: topicMatches.length,
      topic,
    });
  }

  /**
   * Mark corrections as auto-resolved (AC3 step 4).
   * AiCorrectionLog content fields are immutable (AC1), but `wasAutoResolved`
   * is a status flag explicitly updated when corrections generate a knowledge
   * article (AC3). This is the sole permitted UPDATE on this table.
   */
  private async markCorrectionsResolved(correctionIds: string[]): Promise<void> {
    if (correctionIds.length === 0) return;

    await this.db.aiCorrectionLog.updateMany({
      where: { id: { in: correctionIds } },
      data: { wasAutoResolved: true },
    });
  }
}

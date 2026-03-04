// ---------------------------------------------------------------------------
// Knowledge Article Event Handlers — E5d-1 Task 8.3
// Subscribe to knowledge article events for logging and learning signals.
// Handlers are fire-and-forget — failures NEVER block the primary operation.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

import type { EventBus } from '../core/events/event-bus.js';
import type { BusinessEvents } from '../core/events/event-bus.types.js';

/**
 * Register event bus subscribers for knowledge article events.
 *
 * Called during AI plugin startup from index.ts.
 * Each subscriber wraps its handler in try/catch — failures must NEVER
 * propagate to the event emitter or block the primary business operation.
 */
export function registerKnowledgeArticleEvents(
  eventBus: EventBus,
  db: PrismaClient,
  logger: Logger,
): void {
  // ── ai.knowledge.articleCreated ──────────────────────────────────────────
  // Log at info level; placeholder for future RAG pipeline re-index triggers
  eventBus.on(
    'ai.knowledge.articleCreated',
    (payload: BusinessEvents['ai.knowledge.articleCreated']) => {
      logger.info(
        {
          articleId: payload.articleId,
          companyId: payload.companyId,
          category: payload.category,
          source: payload.source,
          confidenceScore: payload.confidenceScore,
        },
        'Knowledge article created — available for RAG retrieval',
      );
    },
  );

  // ── ai.knowledge.articleUsed ────────────────────────────────────────────
  // Update learning signals tracking — aggregate daily usage metrics
  eventBus.on(
    'ai.knowledge.articleUsed',
    async (payload: BusinessEvents['ai.knowledge.articleUsed']) => {
      try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // Upsert learning signal for the 'knowledge_rag' skill on today's date
        await db.aiLearningSignal.upsert({
          where: {
            companyId_skillKey_signalDate: {
              companyId: payload.companyId,
              skillKey: 'knowledge_rag',
              signalDate: today,
            },
          },
          create: {
            companyId: payload.companyId,
            skillKey: 'knowledge_rag',
            signalDate: today,
            totalQueries: 1,
            successCount: 0,
            correctionCount: 0,
            avgConfidence: 0,
          },
          update: {
            totalQueries: { increment: 1 },
          },
        });
      } catch (err) {
        logger.warn(
          { err, articleId: payload.articleId, companyId: payload.companyId },
          'Knowledge article used event: failed to update learning signals',
        );
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Correction Event Handlers — E5d-2 Task 2.5 / Task 3.3
// Subscribe to correction events for pattern detection and logging.
// Handlers are fire-and-forget — failures NEVER propagate to the emitter.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';
import type { BusinessEvents } from '../core/events/event-bus.types.js';
import type { CorrectionPatternService } from './correction-pattern.service.js';

/**
 * Register event bus subscribers for AI correction events.
 *
 * Called during AI plugin startup from index.ts.
 * Each subscriber wraps its handler in try/catch — failures must NEVER
 * propagate to the event emitter or block the primary business operation.
 */
export function registerCorrectionEvents(
  eventBus: EventBus,
  _db: PrismaClient,
  logger: Logger,
  correctionPatternService: CorrectionPatternService,
): void {
  // ── ai.correction.logged ──────────────────────────────────────────────────
  // Trigger pattern detection — fire-and-forget, async
  // ISSUE #6 FIX: Reconstruct CorrectionRecord from event payload instead of
  // re-fetching from DB — the emitter now carries the full record data.
  eventBus.on('ai.correction.logged', async (payload: BusinessEvents['ai.correction.logged']) => {
    try {
      const correction = {
        id: payload.correctionId,
        companyId: payload.companyId,
        userId: payload.userId,
        skillKey: payload.skillKey,
        correctionType: payload.correctionType,
        originalResponse: payload.originalResponse,
        correctedResponse: payload.correctedResponse,
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        wasAutoResolved: payload.wasAutoResolved,
        createdAt: new Date(payload.createdAt),
      };

      await correctionPatternService.checkAndGenerateArticle(correction);
    } catch (err) {
      logger.warn(
        { err, correctionId: payload.correctionId, companyId: payload.companyId },
        'Correction logged event: pattern detection failed — non-fatal',
      );
    }
  });

  // ── ai.correction.autoArticleGenerated ──────────────────────────────────
  // Log at info level — placeholder for future admin notification (E5d-5)
  eventBus.on(
    'ai.correction.autoArticleGenerated',
    (payload: BusinessEvents['ai.correction.autoArticleGenerated']) => {
      logger.info(
        {
          articleId: payload.articleId,
          companyId: payload.companyId,
          correctionCount: payload.correctionCount,
          topic: payload.topic,
        },
        'Auto-generated knowledge article from correction pattern — pending admin review',
      );
    },
  );
}

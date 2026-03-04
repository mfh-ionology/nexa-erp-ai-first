// ---------------------------------------------------------------------------
// CorrectionCaptureService — Captures user corrections to AI responses and
// auto-categorises them for feedback loop processing (E5d-2 Task 1, AC #1, #2)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Valid correction types for auto-categorisation */
export const VALID_CORRECTION_TYPES = [
  'TERMINOLOGY',
  'PROCESS',
  'DATA',
  'PREFERENCE',
  'OTHER',
] as const;

export type CorrectionType = (typeof VALID_CORRECTION_TYPES)[number];

// ─── Keyword dictionaries for categorisation (AC #2) ──────────────────────────

const TERMINOLOGY_KEYWORDS = [
  'called',
  'means',
  'we say',
  'abbreviation',
  'term',
  'name',
  'known as',
  'referred to',
];
const PROCESS_KEYWORDS = [
  'step',
  'workflow',
  'approval',
  'process',
  'should do',
  'instead',
  'procedure',
  'chain',
  'flow',
];
const DATA_KEYWORDS = [
  'amount',
  'code',
  'account',
  'number',
  'value',
  'rate',
  'price',
  'total',
  'balance',
  'quantity',
];
const PREFERENCE_KEYWORDS = [
  'prefer',
  'always',
  'default',
  'format',
  'sort',
  'order',
  'display',
  'show',
  'layout',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptureInput {
  companyId: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  skillKey?: string;
  originalResponse: string;
  correctedResponse: string;
}

export interface CorrectionRecord {
  id: string;
  companyId: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  skillKey: string | null;
  originalResponse: string;
  correctedResponse: string;
  correctionType: string;
  wasAutoResolved: boolean;
  createdAt: Date;
}

// ─── Categorisation (pure function, AC #2) ────────────────────────────────────

/**
 * Auto-categorise a correction based on keyword heuristics.
 * Deterministic, fast (string matching, no LLM call).
 * Checks correctedResponse first (primary signal), then the diff text.
 */
export function categorise(originalResponse: string, correctedResponse: string): CorrectionType {
  const correctedLower = correctedResponse.toLowerCase();
  const diffText = getDiffText(originalResponse, correctedResponse).toLowerCase();
  const searchText = `${correctedLower} ${diffText}`;

  // Score each category by keyword matches
  const scores: Record<CorrectionType, number> = {
    TERMINOLOGY: 0,
    PROCESS: 0,
    DATA: 0,
    PREFERENCE: 0,
    OTHER: 0,
  };

  for (const kw of TERMINOLOGY_KEYWORDS) {
    if (searchText.includes(kw)) scores.TERMINOLOGY++;
  }
  for (const kw of PROCESS_KEYWORDS) {
    if (searchText.includes(kw)) scores.PROCESS++;
  }
  for (const kw of DATA_KEYWORDS) {
    if (searchText.includes(kw)) scores.DATA++;
  }
  for (const kw of PREFERENCE_KEYWORDS) {
    if (searchText.includes(kw)) scores.PREFERENCE++;
  }

  // Find the category with the highest score
  let best: CorrectionType = 'OTHER';
  let bestScore = 0;
  for (const type of VALID_CORRECTION_TYPES) {
    if (type === 'OTHER') continue;
    if (scores[type] > bestScore) {
      bestScore = scores[type];
      best = type;
    }
  }

  return best;
}

/**
 * Get a simple diff between original and corrected text.
 * Returns the corrected text that differs from the original.
 */
function getDiffText(original: string, corrected: string): string {
  // Simple approach: words in corrected that are not in original
  const originalWords = new Set(original.toLowerCase().split(/\s+/));
  const correctedWords = corrected.split(/\s+/);
  const diffWords = correctedWords.filter((w) => !originalWords.has(w.toLowerCase()));
  return diffWords.join(' ');
}

// ─── CorrectionCaptureService ─────────────────────────────────────────────────

export class CorrectionCaptureService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Capture a user correction to an AI response.
   * Creates an AiCorrectionLog record with auto-categorisation.
   * Content fields (originalResponse, correctedResponse, correctionType) are
   * immutable — no UPDATE or DELETE for content (AC1). The `wasAutoResolved`
   * status flag is the sole exception, updated by CorrectionPatternService (AC3).
   * Emits `ai.correction.logged` event for downstream processing.
   * Designed to complete within 200ms (fire-and-forget from chat).
   */
  async captureCorrection(input: CaptureInput): Promise<CorrectionRecord> {
    const correctionType = categorise(input.originalResponse, input.correctedResponse);

    const correction = await this.db.aiCorrectionLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        skillKey: input.skillKey ?? null,
        originalResponse: input.originalResponse,
        correctedResponse: input.correctedResponse,
        correctionType,
      },
    });

    this.logger.info(
      { correctionId: correction.id, companyId: input.companyId, correctionType },
      'Correction captured',
    );

    // Emit event for downstream handlers (pattern detection, etc.)
    // ISSUE #6 FIX: Carry full record data so event handler avoids a DB round-trip
    this.eventBus.emit('ai.correction.logged', {
      correctionId: correction.id,
      companyId: input.companyId,
      userId: input.userId,
      skillKey: input.skillKey ?? null,
      correctionType,
      originalResponse: input.originalResponse,
      correctedResponse: input.correctedResponse,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      wasAutoResolved: false,
      createdAt: correction.createdAt.toISOString(),
    });

    return this.toRecord(correction);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  private toRecord(row: any): CorrectionRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      userId: row.userId,
      conversationId: row.conversationId,
      messageId: row.messageId,
      skillKey: row.skillKey,
      originalResponse: row.originalResponse,
      correctedResponse: row.correctedResponse,
      correctionType: row.correctionType,
      wasAutoResolved: row.wasAutoResolved,
      createdAt: row.createdAt,
    };
  }
}

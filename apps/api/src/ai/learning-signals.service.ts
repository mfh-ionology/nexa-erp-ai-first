// ---------------------------------------------------------------------------
// LearningSignalsService — Aggregates per-skill, per-company learning metrics
// from correction logs and AI session data (E5d-2 Task 6, AC #6, #7)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** High correction rate threshold (AC #7) */
const HIGH_CORRECTION_RATE_THRESHOLD = 0.3;

/** Minimum queries in the 7-day window before alerting (AC #7) */
const MIN_QUERIES_FOR_ALERT = 10;

/** Number of days for the high correction rate lookback window */
const ALERT_LOOKBACK_DAYS = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AggregationResult {
  processedCompanies: number;
  signalsCreated: number;
}

export interface LearningSignalRecord {
  id: string;
  companyId: string;
  skillKey: string;
  signalDate: Date;
  totalQueries: number;
  successCount: number;
  correctionCount: number;
  avgConfidence: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── LearningSignalsService ───────────────────────────────────────────────────

export class LearningSignalsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Aggregate learning signals for a single day across all companies.
   * Processes the previous day's data (or the given date).
   * Creates/upserts AiLearningSignal rows per (company, skill, date).
   */
  async aggregateForDate(date: Date): Promise<AggregationResult> {
    const dayStart = startOfDay(date);

    // Find all companies that had corrections on this date
    const companiesWithCorrections = await this.db.aiCorrectionLog.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lt: addDays(dayStart, 1),
        },
        skillKey: { not: null },
      },
      distinct: ['companyId'],
      select: { companyId: true },
    });

    // ISSUE #7 FIX: Use aiMessage.createdAt (via conversation relation) to find
    // companies with actual message activity on the target date. Previously used
    // aiConversation.createdAt which misses activity in pre-existing conversations.
    const companiesWithMessages = await this.db.aiMessage.findMany({
      where: {
        role: 'assistant',
        createdAt: {
          gte: dayStart,
          lt: addDays(dayStart, 1),
        },
      },
      distinct: ['conversationId'],
      select: {
        conversation: { select: { companyId: true } },
      },
    });

    // Extract unique companyIds from the message results
    const messageCompanyIds = [
      ...new Set(companiesWithMessages.map((m) => m.conversation.companyId)),
    ];

    // Merge unique company IDs
    const companyIds = [
      ...new Set([...companiesWithCorrections.map((c) => c.companyId), ...messageCompanyIds]),
    ];

    if (companyIds.length === 0) {
      this.logger.info(
        { date: dayStart.toISOString() },
        'No AI activity on date — no signals to create',
      );
      return { processedCompanies: 0, signalsCreated: 0 };
    }

    let totalSignals = 0;

    for (const companyId of companyIds) {
      const signalsCreated = await this.aggregateForCompany(companyId, dayStart);
      totalSignals += signalsCreated;
    }

    this.logger.info(
      {
        date: dayStart.toISOString(),
        processedCompanies: companyIds.length,
        signalsCreated: totalSignals,
      },
      'Learning signals aggregation complete',
    );

    return { processedCompanies: companyIds.length, signalsCreated: totalSignals };
  }

  /**
   * Aggregate learning signals for a single company on a single day.
   * Returns the number of signal rows upserted.
   *
   * For each skill active in the company (derived from correction log and AI session data):
   * - totalQueries: count of assistant messages for the company on that date
   *   (AiMessage doesn't have skillKey — per-skill attribution improves with E5d-3)
   * - correctionCount: corrections logged for this skill on that date
   * - successCount: totalQueries - correctionCount
   * - avgConfidence: 0 (placeholder, improves with E5d-3)
   */
  async aggregateForCompany(companyId: string, date: Date): Promise<number> {
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);

    // Get corrections grouped by skillKey for this company on this date
    const corrections = await this.db.aiCorrectionLog.groupBy({
      by: ['skillKey'],
      where: {
        companyId,
        createdAt: { gte: dayStart, lt: dayEnd },
        skillKey: { not: null },
      },
      _count: { id: true },
    });

    // Count total AI assistant messages for this company on this date
    // This serves as a proxy for totalQueries (per-skill tracking not yet available)
    const totalMessages = await this.db.aiMessage.count({
      where: {
        role: 'assistant',
        createdAt: { gte: dayStart, lt: dayEnd },
        conversation: { companyId },
      },
    });

    if (corrections.length === 0 && totalMessages === 0) {
      // No AI activity — sparse storage (no signal rows created per AC6)
      return 0;
    }

    // Get distinct skill keys from corrections
    const skillKeys = corrections.map((c) => c.skillKey).filter((k): k is string => k !== null);

    if (skillKeys.length === 0) {
      // Messages exist but no corrections with skill attribution — cannot create
      // per-skill signals without per-message skill tracking (deferred to E5d-3).
      // Log so the limitation is visible rather than silently dropping activity data.
      this.logger.debug(
        { companyId, date: dayStart.toISOString(), totalMessages },
        'AI messages with no skill-attributed corrections — skipping signal creation (E5d-3 will add per-message skill tracking)',
      );
      return 0;
    }

    // ISSUE #3 FIX: Distribute messages without inflating totalQueries.
    // Strategy: each skill gets at least correctionCount queries (known minimum).
    // Remaining messages (totalMessages - sum(correctionCount)) are distributed
    // proportionally. This ensures sum(totalQueries) <= totalMessages.
    const totalCorrectionCount = corrections.reduce((sum, c) => sum + c._count.id, 0);
    const remainingMessages = Math.max(0, totalMessages - totalCorrectionCount);

    // First pass: floor distribution of remaining messages
    const allocations = corrections.map((c) => {
      const correctionCount = c._count.id;
      const extraQueries =
        totalCorrectionCount > 0
          ? Math.floor((correctionCount / totalCorrectionCount) * remainingMessages)
          : Math.floor(remainingMessages / skillKeys.length);
      return { skillKey: c.skillKey!, correctionCount, extraQueries };
    });

    // Distribute rounding remainder (at most skillKeys.length - 1 messages)
    const allocatedExtra = allocations.reduce((s, a) => s + a.extraQueries, 0);
    let remainder = remainingMessages - allocatedExtra;
    for (const alloc of allocations) {
      if (remainder <= 0) break;
      alloc.extraQueries++;
      remainder--;
    }

    let signalsCreated = 0;

    for (const alloc of allocations) {
      const { skillKey, correctionCount, extraQueries } = alloc;
      const totalQueries = correctionCount + extraQueries;
      const successCount = extraQueries;

      await this.db.aiLearningSignal.upsert({
        where: {
          companyId_skillKey_signalDate: {
            companyId,
            skillKey,
            signalDate: dayStart,
          },
        },
        create: {
          companyId,
          skillKey,
          signalDate: dayStart,
          totalQueries,
          successCount,
          correctionCount,
          avgConfidence: 0, // Placeholder — improves with E5d-3
        },
        update: {
          totalQueries,
          successCount,
          correctionCount,
          avgConfidence: 0,
        },
      });

      signalsCreated++;
    }

    // After aggregation, check for high correction rate alerts
    await this.checkHighCorrectionRates(companyId);

    return signalsCreated;
  }

  /**
   * Check for skills with high correction rates over the last 7 days (AC #7).
   *
   * For each skill/company combination:
   * - Calculate correctionRate = sum(correctionCount) / sum(totalQueries)
   * - If correctionRate > 30% AND sum(totalQueries) >= 10:
   *   - Log warning
   *   - Emit ai.learning.signalAggregated event
   */
  async checkHighCorrectionRates(companyId: string): Promise<void> {
    const cutoffDate = addDays(startOfDay(new Date()), -ALERT_LOOKBACK_DAYS);

    // Get aggregated signals for the last 7 days for this company
    const signals = await this.db.aiLearningSignal.groupBy({
      by: ['skillKey'],
      where: {
        companyId,
        signalDate: { gte: cutoffDate },
      },
      _sum: {
        totalQueries: true,
        correctionCount: true,
        successCount: true,
      },
    });

    for (const signal of signals) {
      const totalQueries = signal._sum.totalQueries ?? 0;
      const correctionCount = signal._sum.correctionCount ?? 0;

      // Skip skills with insufficient sample size
      if (totalQueries < MIN_QUERIES_FOR_ALERT) {
        continue;
      }

      const correctionRate = correctionCount / totalQueries;
      const successRate = 1 - correctionRate;

      if (correctionRate > HIGH_CORRECTION_RATE_THRESHOLD) {
        const ratePercent = Math.round(correctionRate * 100);

        this.logger.warn(
          {
            skillKey: signal.skillKey,
            companyId,
            correctionRate: ratePercent,
            totalQueries,
            correctionCount,
          },
          `Skill ${signal.skillKey} has ${ratePercent}% correction rate over last 7 days for company ${companyId}`,
        );

        this.eventBus.emit('ai.learning.signalAggregated', {
          companyId,
          skillKey: signal.skillKey,
          successRate: Math.round(successRate * 100) / 100,
          correctionRate: Math.round(correctionRate * 100) / 100,
        });
      }
    }
  }
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
// Simple helpers to avoid pulling in a date library for basic date arithmetic.

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// CrossTenantAggregationService — Daily aggregation of anonymised tenant data
// Source: E5d-3 AC#4 (Daily Aggregation), AC#6 (Tenant Opt-Out)
// ---------------------------------------------------------------------------

import type { PlatformPrismaClient } from '../client.js';
import type { TenantDbConnector, ConnectorLogger } from './tenant-db-connector.js';
import type {
  TenantRawData,
  RawLearningSignal,
  RawCorrectionEntry,
  AnonymisedPatterns,
  AnonymisedCorrections,
} from './anonymisation.service.js';
import {
  anonymiseUsagePatterns,
  anonymiseCorrectionPatterns,
  validateNoPersonalData,
} from './anonymisation.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AggregationResult {
  processedTenants: number;
  skippedTenants: number;
  patternsCreated: number;
  correctionsCreated: number;
}

interface SkillSignalAccumulator {
  tenantCount: number;
  totalQueries: number;
  totalSuccess: number;
  totalCorrections: number;
  weightedConfidence: number; // sum(avg_confidence * total_queries)
}

interface TenantRecord {
  id: string;
  code: string;
  dbHost: string;
  dbName: string;
  dbPort: number;
  industry: string | null;
  plan: { code: string };
  featureFlags: Array<{ featureKey: string; enabled: boolean }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CrossTenantAggregationService {
  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly logger: ConnectorLogger,
    private readonly dbConnector: TenantDbConnector,
  ) {}

  /**
   * Main entry point: aggregate anonymised data from all opted-in tenants
   * for the given date (typically T-1 / yesterday).
   */
  async aggregateForDate(date: Date): Promise<AggregationResult> {
    const result: AggregationResult = {
      processedTenants: 0,
      skippedTenants: 0,
      patternsCreated: 0,
      correctionsCreated: 0,
    };

    const tenants = await this.getActiveTenants();
    const allTenantSignals: RawLearningSignal[][] = [];

    // Process sequentially — avoid overwhelming tenant DBs (AC#4)
    for (const tenant of tenants) {
      if (this.isOptedOut(tenant)) {
        this.logger.info(
          `Tenant ${tenant.code} opted out of anonymised pattern sharing — skipping`,
        );
        result.skippedTenants++;
        continue;
      }

      try {
        const tenantResult = await this.processTenant(tenant, date);
        if (tenantResult === null) {
          // Connection failure — count as skipped per AC#2
          result.skippedTenants++;
          continue;
        }
        result.processedTenants++;
        result.patternsCreated += tenantResult.patternsCreated;
        result.correctionsCreated += tenantResult.correctionsCreated;
        if (tenantResult.learningSignals.length > 0) {
          allTenantSignals.push(tenantResult.learningSignals);
        }
      } catch (err) {
        this.logger.error(
          `Failed to process tenant ${tenant.code}: ${err instanceof Error ? err.message : String(err)}`,
        );
        result.skippedTenants++;
      }
    }

    // Skill effectiveness aggregation (AC#5) — uses signals collected above
    if (allTenantSignals.length > 0) {
      const effectivenessCount = await this.aggregateSkillEffectiveness(date, allTenantSignals);
      this.logger.info(`Skill effectiveness: ${effectivenessCount} records upserted`);
    }

    this.logger.info(
      `Aggregation complete: ${result.processedTenants} processed, ${result.skippedTenants} skipped, ${result.patternsCreated} patterns, ${result.correctionsCreated} corrections`,
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Tenant iteration & opt-out (AC#4, AC#6)
  // -------------------------------------------------------------------------

  private async getActiveTenants(): Promise<TenantRecord[]> {
    return this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        dbHost: true,
        dbName: true,
        dbPort: true,
        industry: true,
        plan: { select: { code: true } },
        featureFlags: {
          where: { featureKey: 'share_anonymised_ai_patterns' },
          select: { featureKey: true, enabled: true },
        },
      },
    });
  }

  /**
   * AC#6: If flag exists and enabled=false → opted out.
   * If flag does not exist → default opt-in.
   */
  private isOptedOut(tenant: TenantRecord): boolean {
    const flag = tenant.featureFlags.find((f) => f.featureKey === 'share_anonymised_ai_patterns');
    return flag !== undefined && !flag.enabled;
  }

  // -------------------------------------------------------------------------
  // Per-tenant data extraction (AC#4 — raw SQL via TenantDbConnector)
  // -------------------------------------------------------------------------

  private async processTenant(
    tenant: TenantRecord,
    date: Date,
  ): Promise<{
    patternsCreated: number;
    correctionsCreated: number;
    learningSignals: RawLearningSignal[];
  } | null> {
    const client = await this.dbConnector.connectToTenantDb({
      dbHost: tenant.dbHost,
      dbName: tenant.dbName,
      dbPort: tenant.dbPort,
    });

    if (!client) {
      this.logger.warn(`Could not connect to tenant ${tenant.code} DB — skipping`);
      return null;
    }

    try {
      const rawData = await this.extractTenantData(client, date);
      const storeResult = await this.storeAnonymisedData(tenant, date, rawData);
      return { ...storeResult, learningSignals: rawData.learningSignals };
    } finally {
      await client.close();
    }
  }

  private async extractTenantData(
    client: Awaited<ReturnType<TenantDbConnector['connectToTenantDb']>> & object,
    date: Date,
  ): Promise<TenantRawData> {
    const dateStr = formatDate(date);
    const dayStart = `${dateStr}T00:00:00.000Z`;
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayEnd = `${formatDate(nextDay)}T00:00:00.000Z`;

    // Read learning signals for target date
    const signals = await client.query<RawLearningSignal>(
      `SELECT skill_key, total_queries, success_count, correction_count, avg_confidence
       FROM ai_learning_signals
       WHERE signal_date = $1`,
      [dateStr],
    );

    // Read correction log grouped by type and skill for target date
    const corrections = await client.query<RawCorrectionEntry>(
      `SELECT correction_type, skill_key, COUNT(*)::int as count
       FROM ai_correction_log
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY correction_type, skill_key`,
      [dayStart, dayEnd],
    );

    // Read view types (boolean flags only — view names stripped by anonymisation)
    const views = await client.query<{ view_type: string; view_name?: string }>(
      `SELECT DISTINCT
         CASE WHEN layout IS NOT NULL THEN layout ELSE 'list' END as view_type,
         name as view_name
       FROM saved_views
       WHERE created_at < $1`,
      [dayEnd],
    );

    // Read automation usage (counts by type — names stripped by anonymisation)
    const automations = await client.query<{
      automation_type: string;
      automation_name?: string;
      run_count: number;
    }>(
      `SELECT
         trigger_type as automation_type,
         name as automation_name,
         COALESCE(run_count, 0)::int as run_count
       FROM ai_automations
       WHERE created_at < $1`,
      [dayEnd],
    );

    return {
      learningSignals: signals.rows,
      corrections: corrections.rows,
      views: views.rows,
      automations: automations.rows,
    };
  }

  // -------------------------------------------------------------------------
  // Pattern storage with anonymisation (AC#4)
  // -------------------------------------------------------------------------

  private async storeAnonymisedData(
    tenant: TenantRecord,
    date: Date,
    rawData: TenantRawData,
  ): Promise<{ patternsCreated: number; correctionsCreated: number }> {
    // Anonymise raw data
    const patterns: AnonymisedPatterns = anonymiseUsagePatterns(rawData);
    const corrections: AnonymisedCorrections = anonymiseCorrectionPatterns(rawData.corrections);

    // PII validation gate — skip tenant if validation fails
    const patternsValidation = validateNoPersonalData(patterns);
    if (!patternsValidation.valid) {
      this.logger.error(
        `PII detected in anonymised patterns for tenant ${tenant.code}: ${patternsValidation.violations.join('; ')} — skipping`,
      );
      return { patternsCreated: 0, correctionsCreated: 0 };
    }

    const correctionsValidation = validateNoPersonalData(corrections);
    if (!correctionsValidation.valid) {
      this.logger.error(
        `PII detected in anonymised corrections for tenant ${tenant.code}: ${correctionsValidation.violations.join('; ')} — skipping`,
      );
      return { patternsCreated: 0, correctionsCreated: 0 };
    }

    // Upsert pattern using (tenantId, patternDate) unique constraint
    const patternsCreated = await this.upsertPattern(tenant, date, patterns);

    // Upsert corrections aggregates
    const correctionsCreated = await this.upsertCorrections(tenant, date, corrections);

    return { patternsCreated, correctionsCreated };
  }

  private async upsertPattern(
    tenant: TenantRecord,
    date: Date,
    patterns: AnonymisedPatterns,
  ): Promise<number> {
    await this.prisma.tenantAiPattern.upsert({
      where: {
        tenantId_patternDate: {
          tenantId: tenant.id,
          patternDate: date,
        },
      },
      update: {
        industry: tenant.industry,
        planTier: tenant.plan.code,
        queryCategories: patterns.queryCategories,
        skillUsage: patterns.skillUsage,
        viewPatterns: patterns.viewPatterns,
        automationUsage: patterns.automationUsage,
      },
      create: {
        tenantId: tenant.id,
        patternDate: date,
        industry: tenant.industry,
        planTier: tenant.plan.code,
        queryCategories: patterns.queryCategories,
        skillUsage: patterns.skillUsage,
        viewPatterns: patterns.viewPatterns,
        automationUsage: patterns.automationUsage,
      },
    });

    return 1;
  }

  // -------------------------------------------------------------------------
  // Skill effectiveness aggregation (AC#5)
  // -------------------------------------------------------------------------

  /**
   * Aggregates cross-tenant skill effectiveness metrics from learning signals
   * collected during the daily aggregation.
   *
   * For each unique skill across all tenants, calculates weighted averages for
   * success rate, correction rate, and confidence. Also computes a 7-day trend.
   *
   * @param date - The measurement date
   * @param perTenantSignals - Learning signals grouped by tenant (collected during daily aggregation)
   * @returns Number of skill effectiveness records upserted
   */
  async aggregateSkillEffectiveness(
    date: Date,
    perTenantSignals: RawLearningSignal[][] = [],
  ): Promise<number> {
    const skillMetrics = new Map<string, SkillSignalAccumulator>();

    for (const signals of perTenantSignals) {
      const tenantSkills = new Set<string>();

      for (const signal of signals) {
        if (!skillMetrics.has(signal.skill_key)) {
          skillMetrics.set(signal.skill_key, {
            tenantCount: 0,
            totalQueries: 0,
            totalSuccess: 0,
            totalCorrections: 0,
            weightedConfidence: 0,
          });
        }

        const acc = skillMetrics.get(signal.skill_key)!;
        acc.totalQueries += signal.total_queries;
        acc.totalSuccess += signal.success_count;
        acc.totalCorrections += signal.correction_count;
        acc.weightedConfidence += signal.avg_confidence * signal.total_queries;
        tenantSkills.add(signal.skill_key);
      }

      // Increment tenant count once per skill per tenant
      for (const skillKey of tenantSkills) {
        skillMetrics.get(skillKey)!.tenantCount++;
      }
    }

    let count = 0;
    for (const [skillKey, metrics] of skillMetrics) {
      const avgSuccessRate =
        metrics.totalQueries > 0 ? metrics.totalSuccess / metrics.totalQueries : 0;
      const avgCorrectionRate =
        metrics.totalQueries > 0 ? metrics.totalCorrections / metrics.totalQueries : 0;
      const avgConfidence =
        metrics.totalQueries > 0 ? metrics.weightedConfidence / metrics.totalQueries : 0;

      const trend = await this.calculateTrend(skillKey, date, avgSuccessRate);

      await this.prisma.aiSkillEffectiveness.upsert({
        where: {
          skillKey_measureDate: { skillKey, measureDate: date },
        },
        update: {
          tenantCount: metrics.tenantCount,
          totalQueries: metrics.totalQueries,
          avgSuccessRate,
          avgCorrectionRate,
          avgConfidence,
          trend,
        },
        create: {
          skillKey,
          measureDate: date,
          tenantCount: metrics.tenantCount,
          totalQueries: metrics.totalQueries,
          avgSuccessRate,
          avgCorrectionRate,
          avgConfidence,
          trend,
        },
      });
      count++;
    }

    return count;
  }

  /**
   * Calculates trend by comparing current 7-day average success rate to
   * previous 7-day average. Returns IMPROVING (>5% better), DECLINING
   * (>5% worse), STABLE (within 5%), or null if insufficient history.
   */
  private async calculateTrend(
    skillKey: string,
    currentDate: Date,
    currentDaySuccessRate: number,
  ): Promise<string | null> {
    const fourteenDaysAgo = new Date(currentDate);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const history = await this.prisma.aiSkillEffectiveness.findMany({
      where: {
        skillKey,
        measureDate: {
          gte: fourteenDaysAgo,
          lt: currentDate,
        },
      },
      orderBy: { measureDate: 'asc' },
      select: { measureDate: true, avgSuccessRate: true },
    });

    // Need at least 7 days of history to calculate a meaningful trend
    if (history.length < 7) return null;

    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const previousWindow = history.filter((h) => h.measureDate < sevenDaysAgo);
    const recentWindow = history.filter((h) => h.measureDate >= sevenDaysAgo);

    if (previousWindow.length === 0) return null;

    const prevAvg =
      previousWindow.reduce((sum, h) => sum + Number(h.avgSuccessRate), 0) / previousWindow.length;

    // Current window includes recent history + today's calculated rate
    const recentSum = recentWindow.reduce((sum, h) => sum + Number(h.avgSuccessRate), 0);
    const currAvg = (recentSum + currentDaySuccessRate) / (recentWindow.length + 1);

    const diff = currAvg - prevAvg;

    if (diff > 0.05) return 'IMPROVING';
    if (diff < -0.05) return 'DECLINING';
    return 'STABLE';
  }

  // -------------------------------------------------------------------------
  // Correction storage (AC#4)
  // -------------------------------------------------------------------------

  private async upsertCorrections(
    _tenant: TenantRecord,
    date: Date,
    corrections: AnonymisedCorrections,
  ): Promise<number> {
    let count = 0;

    for (const correction of corrections.corrections) {
      // Atomic upsert using the compound unique constraint
      // (patternDate, correctionType, skillKey) — no race condition
      await this.prisma.tenantAiCorrection.upsert({
        where: {
          patternDate_correctionType_skillKey: {
            patternDate: date,
            correctionType: correction.correctionType,
            skillKey: correction.skillKey ?? '',
          },
        },
        update: {
          occurrenceCount: { increment: correction.occurrenceCount },
          tenantCount: { increment: 1 },
          // Do NOT overwrite commonCorrection on update — existing aggregate
          // summary is more representative than one from a single tenant.
          // Do NOT set industry — corrections are cross-tenant aggregates
          // with no meaningful single-tenant industry value.
        },
        create: {
          patternDate: date,
          correctionType: correction.correctionType,
          skillKey: correction.skillKey ?? '',
          occurrenceCount: correction.occurrenceCount,
          tenantCount: 1,
          commonCorrection: correction.commonCorrection,
        },
      });
      count++;
    }

    return count;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a Date as YYYY-MM-DD string for SQL date parameters */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

// ---------------------------------------------------------------------------
// InsightsGenerationService — Weekly insights from aggregated cross-tenant data
// Source: E5d-3 AC#7 (Weekly Insights Generation)
// ---------------------------------------------------------------------------

import type { PlatformPrismaClient } from '../client.js';
import type { ConnectorLogger } from './tenant-db-connector.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsightsResult {
  insightsGenerated: number;
  byType: {
    featureGap: number;
    workflowOpportunity: number;
    defaultCandidate: number;
    skillImprovement: number;
  };
}

export type InsightType =
  | 'FEATURE_GAP'
  | 'WORKFLOW_OPPORTUNITY'
  | 'DEFAULT_CANDIDATE'
  | 'SKILL_IMPROVEMENT';

export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

interface FeatureGapEvidence {
  tenantCount: number;
  correctionCount: number;
  topCorrectionTypes: string[];
  affectedSkills: string[];
}

interface WorkflowOpportunityEvidence {
  tenantPct: number;
  tenantCount: number;
  pattern: string;
  totalOccurrences: number;
}

interface DefaultCandidateEvidence {
  tenantPct: number;
  tenantCount: number;
  configKey: string;
  suggestedDefault: string;
}

interface SkillImprovementEvidence {
  skillKey: string;
  avgCorrectionRate: number;
  avgSuccessRate: number;
  tenantCount: number;
  trend: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 30;

// Feature gap thresholds
const FEATURE_GAP_MIN_TENANTS = 3;
const FEATURE_GAP_HIGH_TENANTS = 10;
const FEATURE_GAP_MEDIUM_TENANTS = 5;
const FEATURE_GAP_MIN_CORRECTION_RATE = 0.4;

// Workflow opportunity thresholds
const WORKFLOW_OPP_MIN_PCT = 0.3;
const WORKFLOW_OPP_HIGH_PCT = 0.5;

// Default candidate thresholds
const DEFAULT_CANDIDATE_MIN_PCT = 0.6;
const DEFAULT_CANDIDATE_HIGH_PCT = 0.8;

// Skill improvement thresholds
const SKILL_IMPROVEMENT_MIN_CORRECTION_RATE = 0.3;
const SKILL_IMPROVEMENT_MIN_TENANTS = 5;
const SKILL_IMPROVEMENT_HIGH_CORRECTION_RATE = 0.5;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InsightsGenerationService {
  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly logger: ConnectorLogger,
  ) {}

  /**
   * Main entry point: generate insights from accumulated aggregated data.
   * Analyses patterns, corrections, and skill effectiveness to detect
   * feature gaps, workflow opportunities, default candidates, and skills
   * needing improvement.
   */
  async generateInsights(): Promise<InsightsResult> {
    const result: InsightsResult = {
      insightsGenerated: 0,
      byType: {
        featureGap: 0,
        workflowOpportunity: 0,
        defaultCandidate: 0,
        skillImprovement: 0,
      },
    };

    const featureGaps = await this.detectFeatureGaps();
    result.byType.featureGap = featureGaps;

    const workflowOpps = await this.detectWorkflowOpportunities();
    result.byType.workflowOpportunity = workflowOpps;

    const defaultCandidates = await this.detectDefaultCandidates();
    result.byType.defaultCandidate = defaultCandidates;

    const skillImprovements = await this.detectSkillImprovements();
    result.byType.skillImprovement = skillImprovements;

    result.insightsGenerated = featureGaps + workflowOpps + defaultCandidates + skillImprovements;

    this.logger.info(
      `Insights generation complete: ${result.insightsGenerated} insights (${featureGaps} feature gaps, ${workflowOpps} workflow opps, ${defaultCandidates} defaults, ${skillImprovements} skill improvements)`,
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Feature Gap detection (AC#7 — high-failure queries with no matching skill)
  // -------------------------------------------------------------------------

  private async detectFeatureGaps(): Promise<number> {
    const since = this.getLookbackDate();
    let count = 0;

    // Get correction patterns from the last 30 days
    const corrections = await this.prisma.tenantAiCorrection.findMany({
      where: { patternDate: { gte: since } },
    });

    // Group by skillKey — empty skillKey means no matching skill exists
    const bySkill = new Map<
      string,
      {
        maxTenantCountPerDate: Map<string, number>;
        correctionCount: number;
        correctionTypes: Set<string>;
      }
    >();

    for (const c of corrections) {
      const key = c.skillKey || '__no_skill__';
      const dateKey = c.patternDate.toISOString();
      const existing = bySkill.get(key);
      if (existing) {
        // Track max tenantCount per date to avoid double-counting within a date
        const currentMax = existing.maxTenantCountPerDate.get(dateKey) ?? 0;
        existing.maxTenantCountPerDate.set(dateKey, Math.max(currentMax, c.tenantCount));
        existing.correctionCount += c.occurrenceCount;
        existing.correctionTypes.add(c.correctionType);
      } else {
        const dateMap = new Map<string, number>();
        dateMap.set(dateKey, c.tenantCount);
        bySkill.set(key, {
          maxTenantCountPerDate: dateMap,
          correctionCount: c.occurrenceCount,
          correctionTypes: new Set([c.correctionType]),
        });
      }
    }

    // Helper to get the peak tenantCount across all dates for a skill
    const peakTenantCount = (dateMap: Map<string, number>): number => {
      let max = 0;
      for (const count of dateMap.values()) {
        if (count > max) max = count;
      }
      return max;
    };

    // Cross-reference with skill effectiveness for high correction rates
    const effectiveness = await this.prisma.aiSkillEffectiveness.findMany({
      where: { measureDate: { gte: since } },
      orderBy: { measureDate: 'desc' },
    });

    // Build a set of skills with high correction rates
    const highCorrectionSkills = new Map<string, { rate: number; tenantCount: number }>();
    const seenSkills = new Set<string>();
    for (const e of effectiveness) {
      // Take only the most recent measurement per skill
      if (seenSkills.has(e.skillKey)) continue;
      seenSkills.add(e.skillKey);

      const correctionRate = Number(e.avgCorrectionRate);
      if (
        correctionRate >= FEATURE_GAP_MIN_CORRECTION_RATE &&
        e.tenantCount >= FEATURE_GAP_MIN_TENANTS
      ) {
        highCorrectionSkills.set(e.skillKey, {
          rate: correctionRate,
          tenantCount: e.tenantCount,
        });
      }
    }

    // Generate insights for skills with no matching skill (empty skillKey)
    const noSkillData = bySkill.get('__no_skill__');
    if (noSkillData) {
      const tenantCount = peakTenantCount(noSkillData.maxTenantCountPerDate);
      if (tenantCount >= FEATURE_GAP_MIN_TENANTS) {
        const severity = this.featureGapSeverity(tenantCount);
        const evidence: FeatureGapEvidence = {
          tenantCount,
          correctionCount: noSkillData.correctionCount,
          topCorrectionTypes: [...noSkillData.correctionTypes].slice(0, 5),
          affectedSkills: [],
        };

        const created = await this.upsertInsight(
          'FEATURE_GAP',
          'Unmatched queries requiring new skills',
          `${tenantCount} tenants have corrections with no matching skill, totalling ${noSkillData.correctionCount} corrections. Top correction types: ${evidence.topCorrectionTypes.join(', ')}.`,
          severity,
          evidence,
        );
        if (created) count++;
      }
    }

    // Generate insights for skills with high correction rates across many tenants
    for (const [skillKey, data] of highCorrectionSkills) {
      const correctionData = bySkill.get(skillKey);
      const severity = this.featureGapSeverity(data.tenantCount);
      const evidence: FeatureGapEvidence = {
        tenantCount: data.tenantCount,
        correctionCount: correctionData?.correctionCount ?? 0,
        topCorrectionTypes: correctionData ? [...correctionData.correctionTypes].slice(0, 5) : [],
        affectedSkills: [skillKey],
      };

      const created = await this.upsertInsight(
        'FEATURE_GAP',
        `High correction rate for skill: ${skillKey}`,
        `Skill "${skillKey}" has a ${(data.rate * 100).toFixed(0)}% correction rate across ${data.tenantCount} tenants, indicating a feature gap.`,
        severity,
        evidence,
      );
      if (created) count++;
    }

    return count;
  }

  private featureGapSeverity(tenantCount: number): InsightSeverity {
    if (tenantCount >= FEATURE_GAP_HIGH_TENANTS) return 'HIGH';
    if (tenantCount >= FEATURE_GAP_MEDIUM_TENANTS) return 'MEDIUM';
    return 'LOW';
  }

  // -------------------------------------------------------------------------
  // Workflow Opportunity detection (AC#7 — repeated manual patterns)
  // -------------------------------------------------------------------------

  private async detectWorkflowOpportunities(): Promise<number> {
    const since = this.getLookbackDate();
    let count = 0;

    const patterns = await this.prisma.tenantAiPattern.findMany({
      where: { patternDate: { gte: since } },
      select: { tenantId: true, automationUsage: true },
    });

    if (patterns.length === 0) return 0;

    // Count unique tenants reporting
    const uniqueTenants = new Set(patterns.map((p) => p.tenantId));
    const totalTenants = uniqueTenants.size;
    if (totalTenants === 0) return 0;

    // Analyse automationUsage JSON across tenants
    // automationUsage is a JSON like { "scheduled": 12, "event_driven": 5 }
    // run_count is cumulative per tenant, so we track max per tenant to avoid
    // inflating totals across multiple daily pattern records.
    const automationTenantCounts = new Map<
      string,
      { tenantIds: Set<string>; perTenantMax: Map<string, number> }
    >();

    for (const p of patterns) {
      const usage = p.automationUsage as Record<string, number> | null;
      if (!usage || typeof usage !== 'object') continue;

      for (const [automationType, runCount] of Object.entries(usage)) {
        if (typeof runCount !== 'number') continue;
        const existing = automationTenantCounts.get(automationType);
        if (existing) {
          existing.tenantIds.add(p.tenantId);
          const currentMax = existing.perTenantMax.get(p.tenantId) ?? 0;
          existing.perTenantMax.set(p.tenantId, Math.max(currentMax, runCount));
        } else {
          automationTenantCounts.set(automationType, {
            tenantIds: new Set([p.tenantId]),
            perTenantMax: new Map([[p.tenantId, runCount]]),
          });
        }
      }
    }

    // Identify automation configurations present in >30% of reporting tenants
    for (const [automationType, data] of automationTenantCounts) {
      const tenantPct = data.tenantIds.size / totalTenants;
      if (tenantPct < WORKFLOW_OPP_MIN_PCT) continue;

      // Sum max-per-tenant values to get deduplicated total across tenants
      let totalOccurrences = 0;
      for (const max of data.perTenantMax.values()) {
        totalOccurrences += max;
      }

      const severity: InsightSeverity = tenantPct >= WORKFLOW_OPP_HIGH_PCT ? 'HIGH' : 'MEDIUM';
      const evidence: WorkflowOpportunityEvidence = {
        tenantPct: Math.round(tenantPct * 100) / 100,
        tenantCount: data.tenantIds.size,
        pattern: automationType,
        totalOccurrences,
      };

      const created = await this.upsertInsight(
        'WORKFLOW_OPPORTUNITY',
        `Common automation pattern: ${automationType}`,
        `${data.tenantIds.size} of ${totalTenants} tenants (${(tenantPct * 100).toFixed(0)}%) use "${automationType}" automations with ${totalOccurrences} total runs. Consider making this a built-in workflow.`,
        severity,
        evidence,
      );
      if (created) count++;
    }

    return count;
  }

  // -------------------------------------------------------------------------
  // Default Candidate detection (AC#7 — configs >60% of tenants create manually)
  // -------------------------------------------------------------------------

  private async detectDefaultCandidates(): Promise<number> {
    const since = this.getLookbackDate();
    let count = 0;

    const patterns = await this.prisma.tenantAiPattern.findMany({
      where: { patternDate: { gte: since } },
      select: { tenantId: true, viewPatterns: true, skillUsage: true },
    });

    if (patterns.length === 0) return 0;

    const uniqueTenants = new Set(patterns.map((p) => p.tenantId));
    const totalTenants = uniqueTenants.size;
    if (totalTenants === 0) return 0;

    // Analyse viewPatterns across tenants
    // viewPatterns is a JSON like { "list": true, "kanban": false, "calendar": true }
    const viewTenantCounts = new Map<string, Set<string>>();

    for (const p of patterns) {
      const views = p.viewPatterns as Record<string, boolean> | null;
      if (!views || typeof views !== 'object') continue;

      for (const [viewType, exists] of Object.entries(views)) {
        if (!exists) continue;
        const existing = viewTenantCounts.get(viewType);
        if (existing) {
          existing.add(p.tenantId);
        } else {
          viewTenantCounts.set(viewType, new Set([p.tenantId]));
        }
      }
    }

    // Analyse skillUsage across tenants
    // skillUsage is a JSON like { "create_invoice": 12, "apply_filter": 89 }
    const skillTenantCounts = new Map<string, Set<string>>();

    for (const p of patterns) {
      const usage = p.skillUsage as Record<string, number> | null;
      if (!usage || typeof usage !== 'object') continue;

      for (const [skillKey, useCount] of Object.entries(usage)) {
        if (typeof useCount !== 'number' || useCount === 0) continue;
        const existing = skillTenantCounts.get(skillKey);
        if (existing) {
          existing.add(p.tenantId);
        } else {
          skillTenantCounts.set(skillKey, new Set([p.tenantId]));
        }
      }
    }

    // Generate insights for view patterns present in >60% of tenants
    for (const [viewType, tenantIds] of viewTenantCounts) {
      const tenantPct = tenantIds.size / totalTenants;
      if (tenantPct < DEFAULT_CANDIDATE_MIN_PCT) continue;

      const severity: InsightSeverity = tenantPct >= DEFAULT_CANDIDATE_HIGH_PCT ? 'HIGH' : 'MEDIUM';
      const evidence: DefaultCandidateEvidence = {
        tenantPct: Math.round(tenantPct * 100) / 100,
        tenantCount: tenantIds.size,
        configKey: `view:${viewType}`,
        suggestedDefault: `Enable "${viewType}" view by default for new tenants`,
      };

      const created = await this.upsertInsight(
        'DEFAULT_CANDIDATE',
        `Default view candidate: ${viewType}`,
        `${tenantIds.size} of ${totalTenants} tenants (${(tenantPct * 100).toFixed(0)}%) have created "${viewType}" views. Consider making this a default.`,
        severity,
        evidence,
      );
      if (created) count++;
    }

    // Generate insights for skills used by >60% of tenants
    for (const [skillKey, tenantIds] of skillTenantCounts) {
      const tenantPct = tenantIds.size / totalTenants;
      if (tenantPct < DEFAULT_CANDIDATE_MIN_PCT) continue;

      const severity: InsightSeverity = tenantPct >= DEFAULT_CANDIDATE_HIGH_PCT ? 'HIGH' : 'MEDIUM';
      const evidence: DefaultCandidateEvidence = {
        tenantPct: Math.round(tenantPct * 100) / 100,
        tenantCount: tenantIds.size,
        configKey: `skill:${skillKey}`,
        suggestedDefault: `Enable skill "${skillKey}" by default for new tenants`,
      };

      const created = await this.upsertInsight(
        'DEFAULT_CANDIDATE',
        `Default skill candidate: ${skillKey}`,
        `${tenantIds.size} of ${totalTenants} tenants (${(tenantPct * 100).toFixed(0)}%) actively use skill "${skillKey}". Consider enabling by default.`,
        severity,
        evidence,
      );
      if (created) count++;
    }

    return count;
  }

  // -------------------------------------------------------------------------
  // Skill Improvement detection (AC#7 — high correction rate skills)
  // -------------------------------------------------------------------------

  private async detectSkillImprovements(): Promise<number> {
    let count = 0;

    // Get the most recent measurement per skill
    const allEffectiveness = await this.prisma.aiSkillEffectiveness.findMany({
      orderBy: { measureDate: 'desc' },
    });

    // Deduplicate — take only the most recent measurement per skill
    const latestBySkill = new Map<
      string,
      {
        skillKey: string;
        avgCorrectionRate: number;
        avgSuccessRate: number;
        tenantCount: number;
        trend: string | null;
      }
    >();

    for (const e of allEffectiveness) {
      if (latestBySkill.has(e.skillKey)) continue;
      latestBySkill.set(e.skillKey, {
        skillKey: e.skillKey,
        avgCorrectionRate: Number(e.avgCorrectionRate),
        avgSuccessRate: Number(e.avgSuccessRate),
        tenantCount: e.tenantCount,
        trend: e.trend,
      });
    }

    // Identify skills with avgCorrectionRate > 0.30 AND tenantCount >= 5
    for (const [, data] of latestBySkill) {
      if (
        data.avgCorrectionRate <= SKILL_IMPROVEMENT_MIN_CORRECTION_RATE ||
        data.tenantCount < SKILL_IMPROVEMENT_MIN_TENANTS
      ) {
        continue;
      }

      const severity: InsightSeverity =
        data.avgCorrectionRate >= SKILL_IMPROVEMENT_HIGH_CORRECTION_RATE ? 'HIGH' : 'MEDIUM';

      const evidence: SkillImprovementEvidence = {
        skillKey: data.skillKey,
        avgCorrectionRate: data.avgCorrectionRate,
        avgSuccessRate: data.avgSuccessRate,
        tenantCount: data.tenantCount,
        trend: data.trend,
      };

      const created = await this.upsertInsight(
        'SKILL_IMPROVEMENT',
        `Skill needs improvement: ${data.skillKey}`,
        `Skill "${data.skillKey}" has a ${(data.avgCorrectionRate * 100).toFixed(0)}% correction rate across ${data.tenantCount} tenants. ${data.trend === 'DECLINING' ? 'Performance is declining.' : data.trend === 'IMPROVING' ? 'Performance is improving but still needs work.' : 'Performance is stable.'}`,
        severity,
        evidence,
      );
      if (created) count++;
    }

    return count;
  }

  // -------------------------------------------------------------------------
  // Duplicate detection & upsert (AC#7)
  // -------------------------------------------------------------------------

  /**
   * Creates or updates an insight with duplicate detection.
   *
   * Before creating, checks if an insight with the same insightType and
   * similar title already exists:
   * - If found and NOT DISMISSED: update evidence and updatedAt (no new record)
   * - If found and DISMISSED: create a new record (issue has resurfaced)
   * - If not found: create a new record
   *
   * @returns true if a new insight was created, false if an existing one was updated
   */
  private async upsertInsight(
    insightType: InsightType,
    title: string,
    description: string,
    severity: InsightSeverity,
    evidence:
      | FeatureGapEvidence
      | WorkflowOpportunityEvidence
      | DefaultCandidateEvidence
      | SkillImprovementEvidence,
  ): Promise<boolean> {
    // Check for existing non-dismissed insight with same type and similar title
    // AC#7: "case-insensitive contains match"
    const existing = await this.prisma.platformAiInsight.findFirst({
      where: {
        insightType,
        title: { contains: title, mode: 'insensitive' },
        status: { not: 'DISMISSED' },
      },
    });

    if (existing) {
      // Update evidence on existing insight
      await this.prisma.platformAiInsight.update({
        where: { id: existing.id },
        data: {
          evidence: evidence as unknown as Record<string, string | number | boolean | null>,
          severity, // update severity in case thresholds changed
          description,
        },
      });
      this.logger.info(`Updated existing insight "${existing.title}" with fresh evidence`);
      return false;
    }

    // Create new insight
    await this.prisma.platformAiInsight.create({
      data: {
        insightType,
        title,
        description,
        evidence: evidence as unknown as Record<string, string | number | boolean | null>,
        severity,
        status: 'NEW',
      },
    });

    return true;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getLookbackDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - LOOKBACK_DAYS);
    return date;
  }
}

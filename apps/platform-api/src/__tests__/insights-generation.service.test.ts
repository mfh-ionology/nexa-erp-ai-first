// ---------------------------------------------------------------------------
// InsightsGenerationService Tests — E5d-3 Task 7.7
// Source: AC#7 (Weekly Insights Generation)
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsightsGenerationService } from '../services/insights-generation.service.js';
import type { ConnectorLogger } from '../services/tenant-db-connector.js';

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

function createMockLogger(): ConnectorLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    tenantAiCorrection: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    tenantAiPattern: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aiSkillEffectiveness: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    platformAiInsight: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'insight-1' }),
      update: vi.fn().mockResolvedValue({ id: 'insight-1' }),
    },
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TODAY = new Date('2026-03-04');

function makeCorrection(
  overrides: Partial<{
    id: string;
    patternDate: Date;
    industry: string | null;
    correctionType: string;
    skillKey: string | null;
    occurrenceCount: number;
    tenantCount: number;
    commonCorrection: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'correction-1',
    patternDate: overrides.patternDate ?? TODAY,
    industry: overrides.industry ?? null,
    correctionType: overrides.correctionType ?? 'wrong_vat_code',
    skillKey: overrides.skillKey ?? null,
    occurrenceCount: overrides.occurrenceCount ?? 10,
    tenantCount: overrides.tenantCount ?? 5,
    commonCorrection: overrides.commonCorrection ?? 'Tenants correct VAT code',
    createdAt: overrides.createdAt ?? TODAY,
  };
}

function makePattern(
  overrides: Partial<{
    tenantId: string;
    automationUsage: Record<string, number>;
    viewPatterns: Record<string, boolean>;
    skillUsage: Record<string, number>;
  }> = {},
) {
  return {
    tenantId: overrides.tenantId ?? 'tenant-1',
    automationUsage: overrides.automationUsage ?? { scheduled: 10 },
    viewPatterns: overrides.viewPatterns ?? { list: true },
    skillUsage: overrides.skillUsage ?? { create_invoice: 50 },
  };
}

function makeEffectiveness(
  overrides: Partial<{
    id: string;
    skillKey: string;
    measureDate: Date;
    tenantCount: number;
    totalQueries: number;
    avgSuccessRate: number;
    avgCorrectionRate: number;
    avgConfidence: number;
    trend: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'eff-1',
    skillKey: overrides.skillKey ?? 'create_invoice',
    measureDate: overrides.measureDate ?? TODAY,
    tenantCount: overrides.tenantCount ?? 5,
    totalQueries: overrides.totalQueries ?? 100,
    avgSuccessRate: overrides.avgSuccessRate ?? 0.85,
    avgCorrectionRate: overrides.avgCorrectionRate ?? 0.15,
    avgConfidence: overrides.avgConfidence ?? 0.88,
    trend: overrides.trend ?? 'STABLE',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InsightsGenerationService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockLogger: ConnectorLogger;
  let service: InsightsGenerationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockLogger = createMockLogger();
    service = new InsightsGenerationService(mockPrisma as any, mockLogger);
  });

  // -----------------------------------------------------------------------
  // generateInsights() — main entry point
  // -----------------------------------------------------------------------

  describe('generateInsights()', () => {
    it('returns zero counts when no data exists', async () => {
      const result = await service.generateInsights();

      expect(result.insightsGenerated).toBe(0);
      expect(result.byType).toEqual({
        featureGap: 0,
        workflowOpportunity: 0,
        defaultCandidate: 0,
        skillImprovement: 0,
      });
    });

    it('logs completion message with counts', async () => {
      await service.generateInsights();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Insights generation complete'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Feature Gap detection (7.2)
  // -----------------------------------------------------------------------

  describe('Feature Gap detection', () => {
    it('creates FEATURE_GAP insight for null skillKey corrections with >= 3 tenants', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({
          skillKey: null,
          tenantCount: 5,
          correctionType: 'unknown_action',
          occurrenceCount: 20,
        }),
        makeCorrection({
          id: 'c2',
          skillKey: null,
          tenantCount: 5,
          correctionType: 'missing_field',
          occurrenceCount: 15,
        }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.featureGap).toBe(1);
      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'FEATURE_GAP',
          title: 'Unmatched queries requiring new skills',
          severity: 'MEDIUM',
          status: 'NEW',
          evidence: expect.objectContaining({
            tenantCount: 5,
            correctionCount: 35,
            topCorrectionTypes: expect.arrayContaining(['unknown_action', 'missing_field']),
            affectedSkills: [],
          }),
        }),
      });
    });

    it('creates FEATURE_GAP insight for high correction rate skills via effectiveness data', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({
          skillKey: 'bad_skill',
          tenantCount: 6,
          correctionType: 'wrong_output',
          occurrenceCount: 30,
        }),
      ]);
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({ skillKey: 'bad_skill', avgCorrectionRate: 0.45, tenantCount: 6 }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.featureGap).toBeGreaterThanOrEqual(1);
      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'FEATURE_GAP',
          title: expect.stringContaining('bad_skill'),
          evidence: expect.objectContaining({
            affectedSkills: ['bad_skill'],
          }),
        }),
      });
    });

    it('sets severity HIGH when >= 10 tenants affected', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 12, correctionType: 'no_skill' }),
      ]);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'HIGH',
        }),
      });
    });

    it('sets severity LOW when < 5 tenants but >= 3', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 3, correctionType: 'no_skill' }),
      ]);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'LOW',
        }),
      });
    });

    it('skips when fewer than 3 tenants have corrections', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 2, correctionType: 'rare_issue' }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.featureGap).toBe(0);
      expect(mockPrisma.platformAiInsight.create).not.toHaveBeenCalled();
    });

    it('skips high correction rate skills below threshold', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({ skillKey: 'ok_skill', avgCorrectionRate: 0.2, tenantCount: 10 }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.featureGap).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Workflow Opportunity detection (7.3)
  // -----------------------------------------------------------------------

  describe('Workflow Opportunity detection', () => {
    it('creates WORKFLOW_OPPORTUNITY when automation used by >30% of tenants', async () => {
      // 4 out of 5 tenants (80%) use "scheduled" automations
      const patterns = [
        makePattern({ tenantId: 't1', automationUsage: { scheduled: 10 } }),
        makePattern({ tenantId: 't2', automationUsage: { scheduled: 5 } }),
        makePattern({ tenantId: 't3', automationUsage: { scheduled: 8 } }),
        makePattern({ tenantId: 't4', automationUsage: { scheduled: 3 } }),
        makePattern({ tenantId: 't5', automationUsage: { event_driven: 2 } }),
      ];
      // Configure mock for both calls (detectWorkflowOpportunities + detectDefaultCandidates)
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      const result = await service.generateInsights();

      expect(result.byType.workflowOpportunity).toBeGreaterThanOrEqual(1);
      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'WORKFLOW_OPPORTUNITY',
          title: expect.stringContaining('scheduled'),
          severity: 'HIGH', // 80% >= 50%
          evidence: expect.objectContaining({
            pattern: 'scheduled',
            tenantCount: 4,
            totalOccurrences: 26,
          }),
        }),
      });
    });

    it('sets severity MEDIUM when 30-49% of tenants match', async () => {
      // 2 out of 5 tenants (40%) use "webhook"
      const patterns = [
        makePattern({ tenantId: 't1', automationUsage: { webhook: 5 } }),
        makePattern({ tenantId: 't2', automationUsage: { webhook: 3 } }),
        makePattern({ tenantId: 't3', automationUsage: { scheduled: 10 } }),
        makePattern({ tenantId: 't4', automationUsage: { scheduled: 2 } }),
        makePattern({ tenantId: 't5', automationUsage: { event_driven: 1 } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      // webhook at 40% should be MEDIUM
      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'WORKFLOW_OPPORTUNITY',
          title: expect.stringContaining('webhook'),
          severity: 'MEDIUM',
        }),
      });
    });

    it('skips automation patterns below 30% threshold', async () => {
      // Only 1 out of 5 tenants (20%) uses "rare_type"
      const patterns = [
        makePattern({ tenantId: 't1', automationUsage: { rare_type: 1 } }),
        makePattern({ tenantId: 't2', automationUsage: { scheduled: 10 } }),
        makePattern({ tenantId: 't3', automationUsage: { scheduled: 5 } }),
        makePattern({ tenantId: 't4', automationUsage: { scheduled: 3 } }),
        makePattern({ tenantId: 't5', automationUsage: { scheduled: 2 } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      // "rare_type" should NOT generate an insight
      const createCalls = (mockPrisma.platformAiInsight.create as any).mock.calls;
      const workflowInsights = createCalls.filter(
        (call: any) =>
          call[0].data.insightType === 'WORKFLOW_OPPORTUNITY' &&
          call[0].data.title.includes('rare_type'),
      );
      expect(workflowInsights).toHaveLength(0);
    });

    it('returns 0 when no patterns exist', async () => {
      const result = await service.generateInsights();

      expect(result.byType.workflowOpportunity).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Default Candidate detection (7.4)
  // -----------------------------------------------------------------------

  describe('Default Candidate detection', () => {
    it('creates DEFAULT_CANDIDATE for view patterns present in >60% of tenants', async () => {
      // 4 out of 5 tenants (80%) have "kanban" views
      const patterns = [
        makePattern({ tenantId: 't1', viewPatterns: { kanban: true, list: true } }),
        makePattern({ tenantId: 't2', viewPatterns: { kanban: true } }),
        makePattern({ tenantId: 't3', viewPatterns: { kanban: true } }),
        makePattern({ tenantId: 't4', viewPatterns: { kanban: true } }),
        makePattern({ tenantId: 't5', viewPatterns: { list: true } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'DEFAULT_CANDIDATE',
          title: expect.stringContaining('kanban'),
          severity: 'HIGH', // 80% >= 80%
          evidence: expect.objectContaining({
            configKey: 'view:kanban',
            tenantCount: 4,
          }),
        }),
      });
    });

    it('creates DEFAULT_CANDIDATE for skills used by >60% of tenants', async () => {
      // All 5 tenants use "apply_filter" skill
      const patterns = [
        makePattern({ tenantId: 't1', skillUsage: { apply_filter: 50 }, viewPatterns: {} }),
        makePattern({ tenantId: 't2', skillUsage: { apply_filter: 30 }, viewPatterns: {} }),
        makePattern({ tenantId: 't3', skillUsage: { apply_filter: 45 }, viewPatterns: {} }),
        makePattern({ tenantId: 't4', skillUsage: { apply_filter: 20 }, viewPatterns: {} }),
        makePattern({ tenantId: 't5', skillUsage: { apply_filter: 10 }, viewPatterns: {} }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'DEFAULT_CANDIDATE',
          title: expect.stringContaining('apply_filter'),
          severity: 'HIGH', // 100% >= 80%
          evidence: expect.objectContaining({
            configKey: 'skill:apply_filter',
            tenantCount: 5,
          }),
        }),
      });
    });

    it('sets severity MEDIUM for 60-79% range', async () => {
      // 3 out of 4 tenants (75%) have "calendar" views
      const patterns = [
        makePattern({ tenantId: 't1', viewPatterns: { calendar: true } }),
        makePattern({ tenantId: 't2', viewPatterns: { calendar: true } }),
        makePattern({ tenantId: 't3', viewPatterns: { calendar: true } }),
        makePattern({ tenantId: 't4', viewPatterns: { list: true } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'DEFAULT_CANDIDATE',
          title: expect.stringContaining('calendar'),
          severity: 'MEDIUM', // 75% >= 60% but < 80%
        }),
      });
    });

    it('skips configurations below 60% threshold', async () => {
      // Only 1 out of 5 tenants (20%) has "calendar"
      const patterns = [
        makePattern({ tenantId: 't1', viewPatterns: { calendar: true } }),
        makePattern({ tenantId: 't2', viewPatterns: { list: true } }),
        makePattern({ tenantId: 't3', viewPatterns: { list: true } }),
        makePattern({ tenantId: 't4', viewPatterns: { list: true } }),
        makePattern({ tenantId: 't5', viewPatterns: { list: true } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      const createCalls = (mockPrisma.platformAiInsight.create as any).mock.calls;
      const calendarInsights = createCalls.filter(
        (call: any) =>
          call[0].data.insightType === 'DEFAULT_CANDIDATE' &&
          call[0].data.title.includes('calendar'),
      );
      expect(calendarInsights).toHaveLength(0);
    });

    it('ignores false viewPattern flags', async () => {
      // All tenants have kanban: false — should NOT trigger
      const patterns = [
        makePattern({ tenantId: 't1', viewPatterns: { kanban: false } }),
        makePattern({ tenantId: 't2', viewPatterns: { kanban: false } }),
        makePattern({ tenantId: 't3', viewPatterns: { kanban: false } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      const createCalls = (mockPrisma.platformAiInsight.create as any).mock.calls;
      const kanbanInsights = createCalls.filter(
        (call: any) =>
          call[0].data.insightType === 'DEFAULT_CANDIDATE' && call[0].data.title.includes('kanban'),
      );
      expect(kanbanInsights).toHaveLength(0);
    });

    it('ignores zero-usage skills', async () => {
      // All tenants have create_invoice: 0 — should NOT trigger
      const patterns = [
        makePattern({ tenantId: 't1', skillUsage: { create_invoice: 0 }, viewPatterns: {} }),
        makePattern({ tenantId: 't2', skillUsage: { create_invoice: 0 }, viewPatterns: {} }),
        makePattern({ tenantId: 't3', skillUsage: { create_invoice: 0 }, viewPatterns: {} }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      const createCalls = (mockPrisma.platformAiInsight.create as any).mock.calls;
      const skillInsights = createCalls.filter(
        (call: any) =>
          call[0].data.insightType === 'DEFAULT_CANDIDATE' &&
          call[0].data.title.includes('create_invoice'),
      );
      expect(skillInsights).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Skill Improvement detection (7.5)
  // -----------------------------------------------------------------------

  describe('Skill Improvement detection', () => {
    it('creates SKILL_IMPROVEMENT for skills with high correction rate and enough tenants', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({
          skillKey: 'bad_skill',
          avgCorrectionRate: 0.55,
          avgSuccessRate: 0.45,
          tenantCount: 8,
          trend: 'DECLINING',
        }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.skillImprovement).toBe(1);
      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'SKILL_IMPROVEMENT',
          title: expect.stringContaining('bad_skill'),
          severity: 'HIGH', // 55% >= 50%
          evidence: expect.objectContaining({
            skillKey: 'bad_skill',
            avgCorrectionRate: 0.55,
            avgSuccessRate: 0.45,
            tenantCount: 8,
            trend: 'DECLINING',
          }),
        }),
      });
    });

    it('sets severity MEDIUM for correction rate 30-49%', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({
          skillKey: 'moderate_skill',
          avgCorrectionRate: 0.35,
          tenantCount: 6,
          trend: 'STABLE',
        }),
      ]);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insightType: 'SKILL_IMPROVEMENT',
          severity: 'MEDIUM',
        }),
      });
    });

    it('skips skills below correction rate threshold', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({
          skillKey: 'good_skill',
          avgCorrectionRate: 0.1,
          tenantCount: 20,
        }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.skillImprovement).toBe(0);
    });

    it('skips skills below tenant count threshold', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({
          skillKey: 'niche_skill',
          avgCorrectionRate: 0.6,
          tenantCount: 3, // < 5
        }),
      ]);

      const result = await service.generateInsights();

      expect(result.byType.skillImprovement).toBe(0);
    });

    it('uses only the most recent measurement per skill', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        // Most recent first (ordered by measureDate desc)
        makeEffectiveness({
          id: 'recent',
          skillKey: 'test_skill',
          measureDate: new Date('2026-03-03'),
          avgCorrectionRate: 0.1, // Currently good
          tenantCount: 10,
        }),
        makeEffectiveness({
          id: 'old',
          skillKey: 'test_skill',
          measureDate: new Date('2026-02-15'),
          avgCorrectionRate: 0.6, // Was bad before
          tenantCount: 10,
        }),
      ]);

      const result = await service.generateInsights();

      // Should use 0.10 (recent) not 0.60 (old) — so no insight
      expect(result.byType.skillImprovement).toBe(0);
    });

    it('includes trend info in description', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({
          skillKey: 'declining_skill',
          avgCorrectionRate: 0.4,
          tenantCount: 7,
          trend: 'DECLINING',
        }),
      ]);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: expect.stringContaining('declining'),
        }),
      });
    });
  });

  // -----------------------------------------------------------------------
  // Duplicate detection (7.6)
  // -----------------------------------------------------------------------

  describe('Duplicate detection', () => {
    it('updates existing non-dismissed insight instead of creating new', async () => {
      // Set up a feature gap scenario
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 5 }),
      ]);

      // Existing insight found
      (mockPrisma.platformAiInsight.findFirst as any).mockResolvedValue({
        id: 'existing-insight',
        insightType: 'FEATURE_GAP',
        title: 'Unmatched queries requiring new skills',
        status: 'NEW',
      });

      const result = await service.generateInsights();

      // Should update, not create
      expect(mockPrisma.platformAiInsight.update).toHaveBeenCalledWith({
        where: { id: 'existing-insight' },
        data: expect.objectContaining({
          evidence: expect.any(Object),
        }),
      });
      // The update counts as 0 new insights
      expect(result.byType.featureGap).toBe(0);
    });

    it('creates new insight when existing one is DISMISSED', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 5 }),
      ]);

      // findFirst returns null because DISMISSED insights are excluded by the query
      (mockPrisma.platformAiInsight.findFirst as any).mockResolvedValue(null);

      const result = await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalled();
      expect(result.byType.featureGap).toBe(1);
    });

    it('creates new insight when no existing match found', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 5 }),
      ]);

      (mockPrisma.platformAiInsight.findFirst as any).mockResolvedValue(null);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'NEW',
        }),
      });
    });

    it('queries for existing insights with case-insensitive title match', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 5 }),
      ]);

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          insightType: 'FEATURE_GAP',
          title: expect.objectContaining({
            contains: expect.any(String),
            mode: 'insensitive',
          }),
          status: { not: 'DISMISSED' },
        }),
      });
    });

    it('updates severity and description on existing insight', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 12 }), // HIGH severity now
      ]);

      (mockPrisma.platformAiInsight.findFirst as any).mockResolvedValue({
        id: 'existing-insight',
        insightType: 'FEATURE_GAP',
        title: 'Unmatched queries requiring new skills',
        status: 'REVIEWED', // was previously reviewed
        severity: 'LOW', // was LOW before
      });

      await service.generateInsights();

      expect(mockPrisma.platformAiInsight.update).toHaveBeenCalledWith({
        where: { id: 'existing-insight' },
        data: expect.objectContaining({
          severity: 'HIGH', // Updated to HIGH
          description: expect.any(String),
        }),
      });
    });

    it('logs when updating existing insight', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({ skillKey: null, tenantCount: 5 }),
      ]);

      (mockPrisma.platformAiInsight.findFirst as any).mockResolvedValue({
        id: 'existing-insight',
        insightType: 'FEATURE_GAP',
        title: 'Unmatched queries requiring new skills',
        status: 'NEW',
      });

      await service.generateInsights();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated existing insight'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Evidence JSON structure (7.7 comprehensive)
  // -----------------------------------------------------------------------

  describe('Evidence JSON structure', () => {
    it('FEATURE_GAP evidence has correct shape', async () => {
      (mockPrisma.tenantAiCorrection.findMany as any).mockResolvedValue([
        makeCorrection({
          skillKey: null,
          tenantCount: 5,
          correctionType: 'ct1',
          occurrenceCount: 10,
        }),
        makeCorrection({
          id: 'c2',
          skillKey: null,
          tenantCount: 5,
          correctionType: 'ct2',
          occurrenceCount: 8,
        }),
      ]);

      await service.generateInsights();

      const createCall = (mockPrisma.platformAiInsight.create as any).mock.calls.find(
        (call: any) => call[0].data.insightType === 'FEATURE_GAP',
      );
      expect(createCall).toBeDefined();
      const evidence = createCall[0].data.evidence;
      expect(evidence).toHaveProperty('tenantCount');
      expect(evidence).toHaveProperty('correctionCount');
      expect(evidence).toHaveProperty('topCorrectionTypes');
      expect(evidence).toHaveProperty('affectedSkills');
      expect(Array.isArray(evidence.topCorrectionTypes)).toBe(true);
      expect(Array.isArray(evidence.affectedSkills)).toBe(true);
    });

    it('WORKFLOW_OPPORTUNITY evidence has correct shape', async () => {
      const patterns = Array.from({ length: 5 }, (_, i) =>
        makePattern({ tenantId: `t${i}`, automationUsage: { scheduled: 10 + i } }),
      );
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      const createCall = (mockPrisma.platformAiInsight.create as any).mock.calls.find(
        (call: any) => call[0].data.insightType === 'WORKFLOW_OPPORTUNITY',
      );
      expect(createCall).toBeDefined();
      const evidence = createCall[0].data.evidence;
      expect(evidence).toHaveProperty('tenantPct');
      expect(evidence).toHaveProperty('tenantCount');
      expect(evidence).toHaveProperty('pattern');
      expect(evidence).toHaveProperty('totalOccurrences');
      expect(typeof evidence.tenantPct).toBe('number');
    });

    it('DEFAULT_CANDIDATE evidence has correct shape', async () => {
      const patterns = Array.from({ length: 5 }, (_, i) =>
        makePattern({
          tenantId: `t${i}`,
          viewPatterns: { kanban: true },
          skillUsage: {},
          automationUsage: {},
        }),
      );
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      const createCall = (mockPrisma.platformAiInsight.create as any).mock.calls.find(
        (call: any) => call[0].data.insightType === 'DEFAULT_CANDIDATE',
      );
      expect(createCall).toBeDefined();
      const evidence = createCall[0].data.evidence;
      expect(evidence).toHaveProperty('tenantPct');
      expect(evidence).toHaveProperty('tenantCount');
      expect(evidence).toHaveProperty('configKey');
      expect(evidence).toHaveProperty('suggestedDefault');
    });

    it('SKILL_IMPROVEMENT evidence has correct shape', async () => {
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        makeEffectiveness({ avgCorrectionRate: 0.4, tenantCount: 6, trend: 'STABLE' }),
      ]);

      await service.generateInsights();

      const createCall = (mockPrisma.platformAiInsight.create as any).mock.calls.find(
        (call: any) => call[0].data.insightType === 'SKILL_IMPROVEMENT',
      );
      expect(createCall).toBeDefined();
      const evidence = createCall[0].data.evidence;
      expect(evidence).toHaveProperty('skillKey');
      expect(evidence).toHaveProperty('avgCorrectionRate');
      expect(evidence).toHaveProperty('avgSuccessRate');
      expect(evidence).toHaveProperty('tenantCount');
      expect(evidence).toHaveProperty('trend');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('Edge cases', () => {
    it('handles null/invalid JSON in automationUsage gracefully', async () => {
      // Construct directly to avoid makePattern's ?? nullish coalescing
      const patterns = [
        { tenantId: 't1', automationUsage: null, viewPatterns: {}, skillUsage: {} },
        { tenantId: 't2', automationUsage: 'invalid', viewPatterns: {}, skillUsage: {} },
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      // Should not throw
      const result = await service.generateInsights();
      expect(result.byType.workflowOpportunity).toBe(0);
    });

    it('handles null/invalid JSON in viewPatterns gracefully', async () => {
      // Construct directly to avoid makePattern's ?? nullish coalescing
      const patterns = [
        { tenantId: 't1', viewPatterns: null, skillUsage: {}, automationUsage: {} },
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      const result = await service.generateInsights();
      expect(result.byType.defaultCandidate).toBe(0);
    });

    it('handles empty effectiveness data', async () => {
      const result = await service.generateInsights();
      expect(result.byType.skillImprovement).toBe(0);
    });

    it('deduplicates tenant patterns across multiple days', async () => {
      // Same tenant reported on two different days — should count as 1 unique tenant
      const patterns = [
        makePattern({ tenantId: 't1', automationUsage: { scheduled: 5 } }),
        makePattern({ tenantId: 't1', automationUsage: { scheduled: 8 } }),
        makePattern({ tenantId: 't2', automationUsage: { scheduled: 3 } }),
      ];
      (mockPrisma.tenantAiPattern.findMany as any).mockResolvedValue(patterns);

      await service.generateInsights();

      // Total unique tenants = 2, "scheduled" used by both = 100%
      const createCall = (mockPrisma.platformAiInsight.create as any).mock.calls.find(
        (call: any) =>
          call[0].data.insightType === 'WORKFLOW_OPPORTUNITY' &&
          call[0].data.title.includes('scheduled'),
      );
      if (createCall) {
        expect(createCall[0].data.evidence.tenantCount).toBe(2);
      }
    });
  });
});

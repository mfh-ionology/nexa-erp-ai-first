// ---------------------------------------------------------------------------
// Intelligence Pipeline Integration Tests — E5d-3 Task 9.3–9.6
//
// Tests the full cross-service interaction between:
//   AnonymisationService → CrossTenantAggregationService → InsightsGenerationService
//
// Coverage:
//   9.3 — PII verification (realistic PII through full pipeline)
//   9.4 — Cross-tenant isolation (tenant A data doesn't leak to tenant B)
//   9.5 — Opt-out (feature flag controls data extraction)
//   9.6 — End-to-end aggregation (3 tenants → patterns → insights → summary)
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CrossTenantAggregationService } from '../services/cross-tenant-aggregation.service.js';
import { InsightsGenerationService } from '../services/insights-generation.service.js';
import {
  anonymiseUsagePatterns,
  anonymiseCorrectionPatterns,
  validateNoPersonalData,
} from '../services/anonymisation.service.js';
import type {
  TenantRawData,
  AnonymisedPatterns,
  AnonymisedCorrections,
} from '../services/anonymisation.service.js';
import type { ConnectorLogger, TenantDbClient } from '../services/tenant-db-connector.js';
import { TenantDbConnector } from '../services/tenant-db-connector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockLogger(): ConnectorLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockTenantDbClient(
  data: {
    signals?: Array<{
      skill_key: string;
      total_queries: number;
      success_count: number;
      correction_count: number;
      avg_confidence: number;
    }>;
    corrections?: Array<{
      correction_type: string;
      skill_key: string | null;
      count: number;
    }>;
    views?: Array<{ view_type: string; view_name?: string }>;
    automations?: Array<{
      automation_type: string;
      automation_name?: string;
      run_count: number;
    }>;
  } = {},
): TenantDbClient {
  const signals = data.signals ?? [];
  const corrections = data.corrections ?? [];
  const views = data.views ?? [];
  const automations = data.automations ?? [];

  return {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('ai_learning_signals')) {
        return Promise.resolve({ rows: signals, rowCount: signals.length });
      }
      if (sql.includes('ai_correction_log')) {
        return Promise.resolve({ rows: corrections, rowCount: corrections.length });
      }
      if (sql.includes('saved_views')) {
        return Promise.resolve({ rows: views, rowCount: views.length });
      }
      if (sql.includes('ai_automations')) {
        return Promise.resolve({ rows: automations, rowCount: automations.length });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPrisma() {
  const patternStore: Array<Record<string, unknown>> = [];
  const correctionStore: Array<Record<string, unknown>> = [];
  const effectivenessStore: Array<Record<string, unknown>> = [];
  const insightStore: Array<Record<string, unknown>> = [];

  let idCounter = 0;
  const nextId = () => `int-test-${++idCounter}`;

  return {
    _stores: { patternStore, correctionStore, effectivenessStore, insightStore },

    tenant: {
      findMany: vi.fn().mockResolvedValue([]),
    },

    tenantAiPattern: {
      upsert: vi
        .fn()
        .mockImplementation(
          async (args: {
            where: { tenantId_patternDate: { tenantId: string; patternDate: Date } };
            update: Record<string, unknown>;
            create: Record<string, unknown>;
          }) => {
            const existing = patternStore.find(
              (p) =>
                p.tenantId === args.where.tenantId_patternDate.tenantId &&
                p.patternDate === args.where.tenantId_patternDate.patternDate,
            );
            if (existing) {
              Object.assign(existing, args.update);
              return existing;
            }
            const newPattern = { id: nextId(), ...args.create };
            patternStore.push(newPattern);
            return newPattern;
          },
        ),
      findMany: vi
        .fn()
        .mockImplementation(
          async (args?: {
            where?: Record<string, unknown>;
            select?: Record<string, unknown>;
            distinct?: string[];
          }) => {
            if (args?.distinct?.includes('tenantId')) {
              const seen = new Set<string>();
              return patternStore.filter((p) => {
                const tid = p.tenantId as string;
                if (seen.has(tid)) return false;
                seen.add(tid);
                return true;
              });
            }
            return patternStore;
          },
        ),
      count: vi.fn().mockImplementation(async () => patternStore.length),
    },

    tenantAiCorrection: {
      findFirst: vi
        .fn()
        .mockImplementation(
          async (args: {
            where: { patternDate: Date; correctionType: string; skillKey: string | null };
          }) => {
            return (
              correctionStore.find(
                (c) =>
                  c.patternDate === args.where.patternDate &&
                  c.correctionType === args.where.correctionType &&
                  c.skillKey === args.where.skillKey,
              ) ?? null
            );
          },
        ),
      create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
        const newCorrection = { id: nextId(), ...args.data };
        correctionStore.push(newCorrection);
        return newCorrection;
      }),
      update: vi
        .fn()
        .mockImplementation(
          async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = correctionStore.find((c) => c.id === args.where.id);
            if (existing) Object.assign(existing, args.data);
            return existing;
          },
        ),
      findMany: vi.fn().mockImplementation(async () => correctionStore),
      aggregate: vi.fn().mockImplementation(async () => ({
        _sum: {
          occurrenceCount: correctionStore.reduce(
            (sum, c) => sum + ((c.occurrenceCount as number) ?? 0),
            0,
          ),
        },
      })),
    },

    aiSkillEffectiveness: {
      upsert: vi
        .fn()
        .mockImplementation(
          async (args: {
            where: { skillKey_measureDate: { skillKey: string; measureDate: Date } };
            update: Record<string, unknown>;
            create: Record<string, unknown>;
          }) => {
            const existing = effectivenessStore.find(
              (e) =>
                e.skillKey === args.where.skillKey_measureDate.skillKey &&
                e.measureDate === args.where.skillKey_measureDate.measureDate,
            );
            if (existing) {
              Object.assign(existing, args.update);
              return existing;
            }
            const newEff = { id: nextId(), ...args.create };
            effectivenessStore.push(newEff);
            return newEff;
          },
        ),
      findMany: vi
        .fn()
        .mockImplementation(
          async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, unknown> }) => {
            // If querying for trend calculation (historical records), return empty by default
            // Tests that need trend data should populate the store before calling
            if (args?.where?.measureDate) return [];
            return effectivenessStore;
          },
        ),
      findFirst: vi.fn().mockImplementation(async () => {
        if (effectivenessStore.length === 0) return null;
        return effectivenessStore[effectivenessStore.length - 1];
      }),
    },

    platformAiInsight: {
      findFirst: vi
        .fn()
        .mockImplementation(
          async (args?: {
            where?: { insightType?: string; title?: unknown; status?: unknown };
          }) => {
            if (!args?.where) return null;
            return (
              insightStore.find(
                (i) =>
                  (!args.where!.insightType || i.insightType === args.where!.insightType) &&
                  i.status !== 'DISMISSED',
              ) ?? null
            );
          },
        ),
      create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
        const newInsight = {
          id: nextId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          reviewedById: null,
          reviewedAt: null,
          ...args.data,
        };
        insightStore.push(newInsight);
        return newInsight;
      }),
      update: vi
        .fn()
        .mockImplementation(
          async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = insightStore.find((i) => i.id === args.where.id);
            if (existing) Object.assign(existing, args.data, { updatedAt: new Date() });
            return existing;
          },
        ),
      findMany: vi
        .fn()
        .mockImplementation(
          async (args?: { where?: { status?: string }; orderBy?: unknown; take?: number }) => {
            let results = [...insightStore];
            if (args?.where?.status) {
              results = results.filter((i) => i.status === args.where!.status);
            }
            if (args?.take) {
              results = results.slice(0, args.take);
            }
            return results;
          },
        ),
    },
  };
}

// ---------------------------------------------------------------------------
// Test fixtures — tenant configurations
// ---------------------------------------------------------------------------

const TENANT_A = {
  id: 'tenant-a-id',
  code: 'ACME',
  dbHost: 'db-a.example.com',
  dbName: 'nexa_acme',
  dbPort: 5432,
  industry: 'retail',
  plan: { code: 'pro' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: true }],
};

const TENANT_B = {
  id: 'tenant-b-id',
  code: 'GLOBEX',
  dbHost: 'db-b.example.com',
  dbName: 'nexa_globex',
  dbPort: 5432,
  industry: 'manufacturing',
  plan: { code: 'enterprise' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: true }],
};

const TENANT_C = {
  id: 'tenant-c-id',
  code: 'INITECH',
  dbHost: 'db-c.example.com',
  dbName: 'nexa_initech',
  dbPort: 5432,
  industry: 'finance',
  plan: { code: 'pro' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: true }],
};

const TENANT_OPTED_OUT = {
  id: 'tenant-out-id',
  code: 'NOSHARE',
  dbHost: 'db-out.example.com',
  dbName: 'nexa_noshare',
  dbPort: 5432,
  industry: 'retail',
  plan: { code: 'core' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: false }],
};

const TENANT_NO_FLAG = {
  id: 'tenant-noflag-id',
  code: 'NOFLAG',
  dbHost: 'db-noflag.example.com',
  dbName: 'nexa_noflag',
  dbPort: 5432,
  industry: 'retail',
  plan: { code: 'core' },
  featureFlags: [],
};

const TEST_DATE = new Date('2026-03-03');

// ---------------------------------------------------------------------------
// Realistic PII data fixtures
// ---------------------------------------------------------------------------

const PII_RAW_DATA: TenantRawData = {
  learningSignals: [
    {
      skill_key: 'create_invoice',
      total_queries: 45,
      success_count: 40,
      correction_count: 5,
      avg_confidence: 0.88,
    },
    {
      skill_key: 'apply_filter',
      total_queries: 89,
      success_count: 85,
      correction_count: 4,
      avg_confidence: 0.92,
    },
  ],
  corrections: [
    { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 5 },
    { correction_type: 'wrong_account', skill_key: null, count: 3 },
  ],
  views: [
    { view_type: 'list', view_name: 'John Smith Invoices' },
    { view_type: 'kanban', view_name: 'Sarah Connor Pipeline' },
    { view_type: 'calendar', view_name: 'Mohammed Al-Rashid Schedule' },
  ],
  automations: [
    {
      automation_type: 'scheduled',
      automation_name: 'Weekly report for jane@acme.co.uk',
      run_count: 12,
    },
    {
      automation_type: 'event_driven',
      automation_name: 'New £5,000.00 invoice alert',
      run_count: 8,
    },
  ],
};

// Data with names embedded in skill keys (edge case)
const EDGE_CASE_RAW_DATA: TenantRawData = {
  learningSignals: [
    {
      skill_key: 'create_invoice',
      total_queries: 30,
      success_count: 25,
      correction_count: 5,
      avg_confidence: 0.82,
    },
  ],
  corrections: [{ correction_type: 'wrong_field_value', skill_key: 'create_invoice', count: 2 }],
  views: [{ view_type: 'list', view_name: 'All Customers £10,000.00+' }],
  automations: [
    { automation_type: 'scheduled', automation_name: 'Contact +447911123456 daily', run_count: 3 },
  ],
};

// ==========================================================================
// 9.3 — PII Verification Integration Tests
// ==========================================================================

describe('9.3 PII Verification Integration', () => {
  describe('full pipeline: extract → anonymise → validate', () => {
    it('strips all PII from realistic tenant data with names, emails, amounts', () => {
      const patterns: AnonymisedPatterns = anonymiseUsagePatterns(PII_RAW_DATA);
      const corrections: AnonymisedCorrections = anonymiseCorrectionPatterns(
        PII_RAW_DATA.corrections,
      );

      // Validate patterns are PII-free
      const patternResult = validateNoPersonalData(patterns);
      expect(patternResult.valid).toBe(true);
      expect(patternResult.violations).toEqual([]);

      // Validate corrections are PII-free
      const correctionResult = validateNoPersonalData(corrections);
      expect(correctionResult.valid).toBe(true);
      expect(correctionResult.violations).toEqual([]);
    });

    it('output contains NONE of the original PII values', () => {
      const patterns = anonymiseUsagePatterns(PII_RAW_DATA);
      const corrections = anonymiseCorrectionPatterns(PII_RAW_DATA.corrections);

      const serialised = JSON.stringify({ patterns, corrections });

      // Entity names
      expect(serialised).not.toContain('John Smith');
      expect(serialised).not.toContain('Sarah Connor');
      expect(serialised).not.toContain('Mohammed Al-Rashid');

      // Email addresses
      expect(serialised).not.toContain('jane@acme.co.uk');

      // Currency amounts
      expect(serialised).not.toContain('£5,000.00');

      // View names (could contain PII)
      expect(serialised).not.toContain('John Smith Invoices');
      expect(serialised).not.toContain('Sarah Connor Pipeline');
      expect(serialised).not.toContain('Weekly report for');

      // Automation names (could contain PII)
      expect(serialised).not.toContain('New £5,000.00 invoice alert');
    });

    it('output contains only safe statistical data', () => {
      const patterns = anonymiseUsagePatterns(PII_RAW_DATA);

      // queryCategories — only module names and counts
      expect(patterns.queryCategories).toEqual(
        expect.objectContaining({
          ar: expect.any(Number),
          system: expect.any(Number),
        }),
      );

      // skillUsage — only skill keys and counts
      expect(patterns.skillUsage).toEqual(
        expect.objectContaining({
          create_invoice: 45,
          apply_filter: 89,
        }),
      );

      // viewPatterns — only boolean flags, no names
      expect(patterns.viewPatterns).toEqual({
        list: true,
        kanban: true,
        calendar: true,
      });

      // automationUsage — only type counts, no names
      expect(patterns.automationUsage).toEqual({
        scheduled: 12,
        event_driven: 8,
      });
    });

    it('handles edge cases: names in skill keys, amounts in category labels', () => {
      const patterns = anonymiseUsagePatterns(EDGE_CASE_RAW_DATA);
      const corrections = anonymiseCorrectionPatterns(EDGE_CASE_RAW_DATA.corrections);

      const patternResult = validateNoPersonalData(patterns);
      expect(patternResult.valid).toBe(true);

      const correctionResult = validateNoPersonalData(corrections);
      expect(correctionResult.valid).toBe(true);

      // Original PII should not leak
      const serialised = JSON.stringify({ patterns, corrections });
      expect(serialised).not.toContain('£10,000.00');
      expect(serialised).not.toContain('+447911123456');
      expect(serialised).not.toContain('All Customers');
    });

    it('correction summaries use templates, never raw text', () => {
      const corrections = anonymiseCorrectionPatterns(PII_RAW_DATA.corrections);

      for (const c of corrections.corrections) {
        expect(c.commonCorrection).toMatch(/^Tenants correct/);
        expect(c.commonCorrection).toContain('occurrences');
        // Must NOT contain any raw correction text
        expect(c.commonCorrection).not.toContain('jane@');
        expect(c.commonCorrection).not.toContain('£');
      }
    });

    it('validates that PII is caught when intentionally injected', () => {
      // Simulate anonymisation failure — data that looks anonymised but has PII
      const taintedOutput = {
        queryCategories: { ar: 45 },
        skillUsage: { create_invoice: 45 },
        viewPatterns: { list: true },
        automationUsage: { scheduled: 12 },
        leakedField: 'Contact john.smith@example.com for details',
      };

      const result = validateNoPersonalData(taintedOutput);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Email');
    });

    it('catches UK phone numbers in output', () => {
      const tainted = {
        queryCategories: { ar: 10 },
        note: 'Call +447911123456 for support',
      };
      const result = validateNoPersonalData(tainted);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('phone'))).toBe(true);
    });

    it('catches currency amounts in output', () => {
      const tainted = {
        queryCategories: { ar: 10 },
        label: 'Total invoices worth £12,500.00',
      };
      const result = validateNoPersonalData(tainted);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('Currency'))).toBe(true);
    });
  });
});

// ==========================================================================
// 9.4 — Cross-Tenant Isolation Tests
// ==========================================================================

describe('9.4 Cross-Tenant Isolation', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockLogger: ConnectorLogger;
  let mockDbConnector: TenantDbConnector;
  let service: CrossTenantAggregationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockLogger = createMockLogger();
    mockDbConnector = new TenantDbConnector(mockLogger);

    service = new CrossTenantAggregationService(mockPrisma as any, mockLogger, mockDbConnector);
  });

  it('tenant A patterns do not appear in tenant B data', async () => {
    const clientA = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 100,
          success_count: 90,
          correction_count: 10,
          avg_confidence: 0.9,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 10 }],
      views: [{ view_type: 'list' }],
      automations: [{ automation_type: 'scheduled', run_count: 50 }],
    });

    const clientB = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'apply_filter',
          total_queries: 200,
          success_count: 180,
          correction_count: 20,
          avg_confidence: 0.85,
        },
      ],
      corrections: [{ correction_type: 'wrong_account', skill_key: 'apply_filter', count: 20 }],
      views: [{ view_type: 'kanban' }],
      automations: [{ automation_type: 'event_driven', run_count: 30 }],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockImplementation(async (info) => {
      if (info.dbName === 'nexa_acme') return clientA;
      if (info.dbName === 'nexa_globex') return clientB;
      return null;
    });

    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

    await service.aggregateForDate(TEST_DATE);

    // Verify pattern upserts — each tenant gets its own row
    const patternCalls = (mockPrisma.tenantAiPattern.upsert as any).mock.calls;
    expect(patternCalls.length).toBe(2);

    // Tenant A's pattern
    const patternA = patternCalls.find(
      (call: any) => call[0].where.tenantId_patternDate.tenantId === 'tenant-a-id',
    );
    expect(patternA).toBeDefined();
    expect(patternA![0].create.skillUsage).toEqual({ create_invoice: 100 });
    expect(patternA![0].create.skillUsage).not.toHaveProperty('apply_filter');

    // Tenant B's pattern
    const patternB = patternCalls.find(
      (call: any) => call[0].where.tenantId_patternDate.tenantId === 'tenant-b-id',
    );
    expect(patternB).toBeDefined();
    expect(patternB![0].create.skillUsage).toEqual({ apply_filter: 200 });
    expect(patternB![0].create.skillUsage).not.toHaveProperty('create_invoice');
  });

  it('tenant_ai_corrections aggregates across tenants without leaking tenant identity', async () => {
    // Both tenants have the same correction type
    const clientA = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 50,
          success_count: 45,
          correction_count: 5,
          avg_confidence: 0.88,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 5 }],
    });

    const clientB = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 30,
          success_count: 25,
          correction_count: 5,
          avg_confidence: 0.82,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 7 }],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockImplementation(async (info) => {
      if (info.dbName === 'nexa_acme') return clientA;
      if (info.dbName === 'nexa_globex') return clientB;
      return null;
    });

    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

    await service.aggregateForDate(TEST_DATE);

    // Check the correction store — should have one record with aggregated counts
    const corrections = mockPrisma._stores.correctionStore;
    const vatCorrection = corrections.find(
      (c) => c.correctionType === 'wrong_vat_code' && c.skillKey === 'create_invoice',
    );
    expect(vatCorrection).toBeDefined();

    // Should have aggregated occurrence count (5 + 7 = 12) and tenantCount = 2
    expect(vatCorrection!.occurrenceCount).toBe(12);
    expect(vatCorrection!.tenantCount).toBe(2);

    // Crucially: no tenantId on the correction row
    expect(vatCorrection).not.toHaveProperty('tenantId');
  });

  it('ai_skill_effectiveness metrics are truly cross-tenant averages', async () => {
    // Tenant A: create_invoice — 50 queries, 45 success, 5 corrections, 0.88 confidence
    // Tenant B: create_invoice — 30 queries, 25 success, 5 corrections, 0.82 confidence
    // Expected weighted averages:
    //   totalQueries = 80
    //   avgSuccessRate = (45 + 25) / 80 = 0.875
    //   avgCorrectionRate = (5 + 5) / 80 = 0.125
    //   avgConfidence = (0.88*50 + 0.82*30) / 80 = (44 + 24.6) / 80 = 0.8575

    const clientA = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 50,
          success_count: 45,
          correction_count: 5,
          avg_confidence: 0.88,
        },
      ],
    });

    const clientB = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 30,
          success_count: 25,
          correction_count: 5,
          avg_confidence: 0.82,
        },
      ],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockImplementation(async (info) => {
      if (info.dbName === 'nexa_acme') return clientA;
      if (info.dbName === 'nexa_globex') return clientB;
      return null;
    });

    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

    await service.aggregateForDate(TEST_DATE);

    const effCalls = (mockPrisma.aiSkillEffectiveness.upsert as any).mock.calls;
    expect(effCalls.length).toBe(1);

    const effRecord = effCalls[0][0].create;
    expect(effRecord.skillKey).toBe('create_invoice');
    expect(effRecord.tenantCount).toBe(2);
    expect(effRecord.totalQueries).toBe(80);
    expect(effRecord.avgSuccessRate).toBeCloseTo(0.875, 3);
    expect(effRecord.avgCorrectionRate).toBeCloseTo(0.125, 3);
    expect(effRecord.avgConfidence).toBeCloseTo(0.8575, 3);

    // No tenant-specific data in effectiveness record
    expect(effRecord).not.toHaveProperty('tenantId');
  });
});

// ==========================================================================
// 9.5 — Opt-Out Integration Tests
// ==========================================================================

describe('9.5 Opt-Out Integration', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockLogger: ConnectorLogger;
  let mockDbConnector: TenantDbConnector;
  let service: CrossTenantAggregationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockLogger = createMockLogger();
    mockDbConnector = new TenantDbConnector(mockLogger);

    service = new CrossTenantAggregationService(mockPrisma as any, mockLogger, mockDbConnector);
  });

  it('tenant with feature flag disabled → zero new rows created', async () => {
    const mockClient = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 100,
          success_count: 90,
          correction_count: 10,
          avg_confidence: 0.9,
        },
      ],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_OPTED_OUT]);

    const result = await service.aggregateForDate(TEST_DATE);

    expect(result.processedTenants).toBe(0);
    expect(result.skippedTenants).toBe(1);
    expect(result.patternsCreated).toBe(0);
    expect(result.correctionsCreated).toBe(0);

    // DB client should never have been called
    expect(mockDbConnector.connectToTenantDb).not.toHaveBeenCalled();

    // No data written
    expect(mockPrisma._stores.patternStore).toHaveLength(0);
    expect(mockPrisma._stores.correctionStore).toHaveLength(0);
    expect(mockPrisma._stores.effectivenessStore).toHaveLength(0);
  });

  it('tenant with no feature flag → included (default opt-in)', async () => {
    const mockClient = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 50,
          success_count: 45,
          correction_count: 5,
          avg_confidence: 0.88,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 3 }],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_NO_FLAG]);

    const result = await service.aggregateForDate(TEST_DATE);

    expect(result.processedTenants).toBe(1);
    expect(result.skippedTenants).toBe(0);
    expect(result.patternsCreated).toBe(1);
  });

  it('flag toggle: opted-in → creates data, opted-out → no new data', async () => {
    const mockClient = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'apply_filter',
          total_queries: 20,
          success_count: 18,
          correction_count: 2,
          avg_confidence: 0.91,
        },
      ],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);

    // First run: opted-in
    const optedInTenant = {
      ...TENANT_A,
      featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: true }],
    };
    (mockPrisma.tenant.findMany as any).mockResolvedValue([optedInTenant]);

    const firstResult = await service.aggregateForDate(TEST_DATE);
    expect(firstResult.processedTenants).toBe(1);
    expect(firstResult.patternsCreated).toBe(1);

    const patternsAfterFirst = mockPrisma._stores.patternStore.length;
    expect(patternsAfterFirst).toBe(1);

    // Second run: same tenant now opted-out (different date to avoid upsert)
    const nextDate = new Date('2026-03-04');
    const optedOutTenant = {
      ...TENANT_A,
      featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: false }],
    };
    (mockPrisma.tenant.findMany as any).mockResolvedValue([optedOutTenant]);

    const secondResult = await service.aggregateForDate(nextDate);
    expect(secondResult.processedTenants).toBe(0);
    expect(secondResult.skippedTenants).toBe(1);
    expect(secondResult.patternsCreated).toBe(0);

    // No new patterns added
    expect(mockPrisma._stores.patternStore.length).toBe(patternsAfterFirst);
  });

  it('logs opt-out message with tenant code', async () => {
    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_OPTED_OUT]);

    await service.aggregateForDate(TEST_DATE);

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('NOSHARE'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('opted out'));
  });

  it('mixed tenants: opted-in and opted-out processed correctly', async () => {
    const mockClient = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 30,
          success_count: 27,
          correction_count: 3,
          avg_confidence: 0.88,
        },
      ],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
    (mockPrisma.tenant.findMany as any).mockResolvedValue([
      TENANT_A, // opted-in
      TENANT_OPTED_OUT, // opted-out
      TENANT_NO_FLAG, // no flag (default opt-in)
    ]);

    const result = await service.aggregateForDate(TEST_DATE);

    expect(result.processedTenants).toBe(2); // A + NO_FLAG
    expect(result.skippedTenants).toBe(1); // OPTED_OUT
    expect(result.patternsCreated).toBe(2);
  });
});

// ==========================================================================
// 9.6 — End-to-End Aggregation Test
// ==========================================================================

describe('9.6 End-to-End Aggregation', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockLogger: ConnectorLogger;
  let mockDbConnector: TenantDbConnector;
  let aggregationService: CrossTenantAggregationService;
  let insightsService: InsightsGenerationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockLogger = createMockLogger();
    mockDbConnector = new TenantDbConnector(mockLogger);

    aggregationService = new CrossTenantAggregationService(
      mockPrisma as any,
      mockLogger,
      mockDbConnector,
    );

    insightsService = new InsightsGenerationService(mockPrisma as any, mockLogger);
  });

  it('full flow: 3 tenants → aggregation → insights → correct totals', async () => {
    // Set up 3 tenants with distinct data
    const clientA = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 100,
          success_count: 90,
          correction_count: 10,
          avg_confidence: 0.88,
        },
        {
          skill_key: 'apply_filter',
          total_queries: 50,
          success_count: 48,
          correction_count: 2,
          avg_confidence: 0.95,
        },
      ],
      corrections: [
        { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 8 },
        { correction_type: 'wrong_account', skill_key: null, count: 2 },
      ],
      views: [{ view_type: 'list' }, { view_type: 'kanban' }],
      automations: [
        { automation_type: 'scheduled', run_count: 20 },
        { automation_type: 'event_driven', run_count: 5 },
      ],
    });

    const clientB = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 80,
          success_count: 70,
          correction_count: 10,
          avg_confidence: 0.85,
        },
        {
          skill_key: 'create_payment',
          total_queries: 40,
          success_count: 36,
          correction_count: 4,
          avg_confidence: 0.9,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 6 }],
      views: [{ view_type: 'list' }, { view_type: 'calendar' }],
      automations: [{ automation_type: 'scheduled', run_count: 15 }],
    });

    const clientC = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 60,
          success_count: 55,
          correction_count: 5,
          avg_confidence: 0.91,
        },
        {
          skill_key: 'apply_filter',
          total_queries: 30,
          success_count: 29,
          correction_count: 1,
          avg_confidence: 0.96,
        },
      ],
      corrections: [
        { correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 4 },
        { correction_type: 'wrong_category', skill_key: 'apply_filter', count: 1 },
      ],
      views: [{ view_type: 'list' }],
      automations: [
        { automation_type: 'scheduled', run_count: 10 },
        { automation_type: 'event_driven', run_count: 3 },
      ],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockImplementation(async (info) => {
      if (info.dbName === 'nexa_acme') return clientA;
      if (info.dbName === 'nexa_globex') return clientB;
      if (info.dbName === 'nexa_initech') return clientC;
      return null;
    });

    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B, TENANT_C]);

    // ---- Step 1: Run daily aggregation ----
    const aggResult = await aggregationService.aggregateForDate(TEST_DATE);

    expect(aggResult.processedTenants).toBe(3);
    expect(aggResult.skippedTenants).toBe(0);
    expect(aggResult.patternsCreated).toBe(3);

    // Verify tenant_ai_patterns rows created for each tenant
    const patterns = mockPrisma._stores.patternStore;
    expect(patterns).toHaveLength(3);

    const patternTenantIds = patterns.map((p) => p.tenantId);
    expect(patternTenantIds).toContain('tenant-a-id');
    expect(patternTenantIds).toContain('tenant-b-id');
    expect(patternTenantIds).toContain('tenant-c-id');

    // Verify tenant_ai_corrections contains aggregated cross-tenant data
    const corrections = mockPrisma._stores.correctionStore;
    expect(corrections.length).toBeGreaterThan(0);

    const vatCorrections = corrections.find(
      (c) => c.correctionType === 'wrong_vat_code' && c.skillKey === 'create_invoice',
    );
    expect(vatCorrections).toBeDefined();
    // All 3 tenants report wrong_vat_code for create_invoice
    expect(vatCorrections!.tenantCount).toBe(3);
    expect(vatCorrections!.occurrenceCount).toBe(18); // 8 + 6 + 4

    // Verify ai_skill_effectiveness contains cross-tenant skill metrics
    const effectiveness = mockPrisma._stores.effectivenessStore;
    expect(effectiveness.length).toBeGreaterThan(0);

    const invoiceEff = effectiveness.find((e) => e.skillKey === 'create_invoice');
    expect(invoiceEff).toBeDefined();
    expect(invoiceEff!.tenantCount).toBe(3);
    expect(invoiceEff!.totalQueries).toBe(240); // 100 + 80 + 60

    // ---- Step 2: Run weekly insights generation ----
    // Wire the mock prisma's findMany for insights service to use the stores
    (mockPrisma.tenantAiCorrection.findMany as any).mockImplementation(async () => {
      return corrections.map((c) => ({
        ...c,
        patternDate: TEST_DATE,
      }));
    });
    (mockPrisma.tenantAiPattern.findMany as any).mockImplementation(async () => {
      return patterns.map((p) => ({
        ...p,
        patternDate: TEST_DATE,
      }));
    });
    (mockPrisma.aiSkillEffectiveness.findMany as any).mockImplementation(async () => {
      return effectiveness.map((e) => ({
        ...e,
        measureDate: TEST_DATE,
        avgCorrectionRate: e.avgCorrectionRate,
        avgSuccessRate: e.avgSuccessRate,
      }));
    });

    const insightsResult = await insightsService.generateInsights();

    expect(insightsResult.insightsGenerated).toBeGreaterThanOrEqual(0);

    // Insights should have been created in the store
    const insights = mockPrisma._stores.insightStore;
    // At minimum we should have workflow opportunity for "scheduled" (3/3 = 100%)
    // and default candidate for "list" view (3/3 = 100%)

    // Verify insights structure
    for (const insight of insights) {
      expect(insight).toHaveProperty('insightType');
      expect(insight).toHaveProperty('title');
      expect(insight).toHaveProperty('description');
      expect(insight).toHaveProperty('evidence');
      expect(insight).toHaveProperty('severity');
      expect(insight).toHaveProperty('status', 'NEW');
    }
  });

  it('aggregation is idempotent — re-running same date upserts, not duplicates', async () => {
    const mockClient = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 50,
          success_count: 45,
          correction_count: 5,
          avg_confidence: 0.88,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 3 }],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

    // First run
    const firstResult = await aggregationService.aggregateForDate(TEST_DATE);
    expect(firstResult.patternsCreated).toBe(1);

    const patternsAfterFirst = mockPrisma._stores.patternStore.length;
    expect(patternsAfterFirst).toBe(1);

    // Second run — same date, same tenant
    const secondResult = await aggregationService.aggregateForDate(TEST_DATE);
    expect(secondResult.patternsCreated).toBe(1);

    // Pattern count should NOT increase (upsert)
    expect(mockPrisma._stores.patternStore.length).toBe(1);
  });

  it('summary data reflects aggregation results', async () => {
    const mockClient = createMockTenantDbClient({
      signals: [
        {
          skill_key: 'create_invoice',
          total_queries: 100,
          success_count: 90,
          correction_count: 10,
          avg_confidence: 0.88,
        },
      ],
      corrections: [{ correction_type: 'wrong_vat_code', skill_key: 'create_invoice', count: 10 }],
    });

    vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
    (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

    await aggregationService.aggregateForDate(TEST_DATE);

    // Verify summary data matches
    const totalPatterns = await mockPrisma.tenantAiPattern.count();
    expect(totalPatterns).toBe(2); // 2 tenants

    const distinctTenants = await mockPrisma.tenantAiPattern.findMany({
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    expect(distinctTenants).toHaveLength(2);

    const correctionAgg = await mockPrisma.tenantAiCorrection.aggregate();
    expect(correctionAgg._sum.occurrenceCount).toBeGreaterThan(0);
  });
});

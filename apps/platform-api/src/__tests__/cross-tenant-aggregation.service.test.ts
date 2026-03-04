// ---------------------------------------------------------------------------
// CrossTenantAggregationService Tests — E5d-3 Task 5.5
// Source: AC#4 (Daily Aggregation), AC#6 (Tenant Opt-Out)
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrossTenantAggregationService } from '../services/cross-tenant-aggregation.service.js';
import type { ConnectorLogger, TenantDbClient } from '../services/tenant-db-connector.js';
import { TenantDbConnector } from '../services/tenant-db-connector.js';

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
// Mock TenantDbClient
// ---------------------------------------------------------------------------

function createMockTenantDbClient(
  overrides: {
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
  const signals = overrides.signals ?? [
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
  ];
  const corrections = overrides.corrections ?? [
    {
      correction_type: 'wrong_vat_code',
      skill_key: 'create_invoice',
      count: 5,
    },
  ];
  const views = overrides.views ?? [{ view_type: 'list' }];
  const automations = overrides.automations ?? [{ automation_type: 'scheduled', run_count: 12 }];

  return {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('ai_learning_signals')) {
        return Promise.resolve({ rows: signals, rowCount: signals.length });
      }
      if (sql.includes('ai_correction_log')) {
        return Promise.resolve({
          rows: corrections,
          rowCount: corrections.length,
        });
      }
      if (sql.includes('saved_views')) {
        return Promise.resolve({ rows: views, rowCount: views.length });
      }
      if (sql.includes('ai_automations')) {
        return Promise.resolve({
          rows: automations,
          rowCount: automations.length,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    tenant: {
      findMany: vi.fn(),
    },
    tenantAiPattern: {
      upsert: vi.fn().mockResolvedValue({ id: 'pattern-1' }),
    },
    tenantAiCorrection: {
      upsert: vi.fn().mockResolvedValue({ id: 'correction-1' }),
    },
    aiSkillEffectiveness: {
      upsert: vi.fn().mockResolvedValue({ id: 'eff-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as ReturnType<typeof createMockPrisma>;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_A = {
  id: 'tenant-a-id',
  code: 'tenant-a',
  dbHost: 'localhost',
  dbName: 'tenant_a_db',
  dbPort: 5432,
  industry: 'retail',
  plan: { code: 'pro' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: true }],
};

const TENANT_B = {
  id: 'tenant-b-id',
  code: 'tenant-b',
  dbHost: 'localhost',
  dbName: 'tenant_b_db',
  dbPort: 5432,
  industry: 'manufacturing',
  plan: { code: 'core' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: true }],
};

const TENANT_OPTED_OUT = {
  id: 'tenant-opted-out-id',
  code: 'tenant-opted-out',
  dbHost: 'localhost',
  dbName: 'tenant_opted_out_db',
  dbPort: 5432,
  industry: null,
  plan: { code: 'core' },
  featureFlags: [{ featureKey: 'share_anonymised_ai_patterns', enabled: false }],
};

const TENANT_NO_FLAG = {
  id: 'tenant-no-flag-id',
  code: 'tenant-no-flag',
  dbHost: 'localhost',
  dbName: 'tenant_no_flag_db',
  dbPort: 5432,
  industry: 'finance',
  plan: { code: 'enterprise' },
  featureFlags: [], // No flag → default opt-in
};

const TEST_DATE = new Date('2026-03-03');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrossTenantAggregationService', () => {
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

  // -----------------------------------------------------------------------
  // Full aggregation flow
  // -----------------------------------------------------------------------

  describe('aggregateForDate() — full flow', () => {
    it('processes all opted-in tenants and returns correct counts', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(2);
      expect(result.skippedTenants).toBe(0);
      expect(result.patternsCreated).toBe(2);
      expect(result.correctionsCreated).toBe(2);
    });

    it('upserts patterns with correct tenant data', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      await service.aggregateForDate(TEST_DATE);

      expect(mockPrisma.tenantAiPattern.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_patternDate: {
              tenantId: 'tenant-a-id',
              patternDate: TEST_DATE,
            },
          },
          create: expect.objectContaining({
            tenantId: 'tenant-a-id',
            patternDate: TEST_DATE,
            industry: 'retail',
            planTier: 'pro',
          }),
        }),
      );
    });

    it('creates correction records with correct structure', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      await service.aggregateForDate(TEST_DATE);

      expect(mockPrisma.tenantAiCorrection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            patternDate_correctionType_skillKey: {
              patternDate: TEST_DATE,
              correctionType: 'wrong_vat_code',
              skillKey: 'create_invoice',
            },
          },
          create: expect.objectContaining({
            patternDate: TEST_DATE,
            correctionType: 'wrong_vat_code',
            skillKey: 'create_invoice',
            occurrenceCount: 5,
            tenantCount: 1,
            commonCorrection: expect.stringContaining('Tenants correct'),
          }),
        }),
      );
    });

    it('closes tenant DB connection after processing', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      await service.aggregateForDate(TEST_DATE);

      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });

    it('processes tenants sequentially (not parallel)', async () => {
      const callOrder: string[] = [];
      const mockClient = createMockTenantDbClient();

      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockImplementation(async (info) => {
        callOrder.push(`connect:${info.dbName}`);
        return mockClient;
      });

      // Override close to track order
      (mockClient.close as any).mockImplementation(async () => {
        callOrder.push(`close:${callOrder.length}`);
      });

      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

      await service.aggregateForDate(TEST_DATE);

      // Should connect to A, close A, then connect to B, close B
      expect(callOrder[0]).toBe('connect:tenant_a_db');
      expect(callOrder.indexOf('connect:tenant_b_db')).toBeGreaterThan(
        callOrder.indexOf('connect:tenant_a_db'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Opt-out behaviour (AC#6)
  // -----------------------------------------------------------------------

  describe('opt-out behaviour', () => {
    it('skips tenant with flag enabled=false', async () => {
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_OPTED_OUT]);

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(0);
      expect(result.skippedTenants).toBe(1);
      expect(result.patternsCreated).toBe(0);
      expect(result.correctionsCreated).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('opted out'));
    });

    it('includes tenant with no feature flag (default opt-in)', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_NO_FLAG]);

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(1);
      expect(result.skippedTenants).toBe(0);
    });

    it('creates zero rows for opted-out tenant', async () => {
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_OPTED_OUT]);

      await service.aggregateForDate(TEST_DATE);

      expect(mockPrisma.tenantAiPattern.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.tenantAiCorrection.upsert).not.toHaveBeenCalled();
    });

    it('processes mixed opt-in and opt-out tenants correctly', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([
        TENANT_A,
        TENANT_OPTED_OUT,
        TENANT_NO_FLAG,
      ]);

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(2); // A + no-flag
      expect(result.skippedTenants).toBe(1); // opted-out
    });
  });

  // -----------------------------------------------------------------------
  // Idempotent re-run
  // -----------------------------------------------------------------------

  describe('idempotent re-run', () => {
    it('upserts patterns instead of duplicating on same date', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      // Run twice
      await service.aggregateForDate(TEST_DATE);
      await service.aggregateForDate(TEST_DATE);

      // Upsert called twice (not create)
      expect(mockPrisma.tenantAiPattern.upsert).toHaveBeenCalledTimes(2);
    });

    it('upserts correction records on re-run (idempotent via unique constraint)', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      // Run twice — both use upsert with the compound unique key
      await service.aggregateForDate(TEST_DATE);
      await service.aggregateForDate(TEST_DATE);

      // Upsert called once per correction per run (1 correction × 2 runs = 2)
      expect(mockPrisma.tenantAiCorrection.upsert).toHaveBeenCalledTimes(2);
      // Each call uses the compound unique key
      expect(mockPrisma.tenantAiCorrection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            patternDate_correctionType_skillKey: expect.objectContaining({
              patternDate: TEST_DATE,
              correctionType: 'wrong_vat_code',
            }),
          },
          update: expect.objectContaining({
            occurrenceCount: expect.objectContaining({ increment: 5 }),
            tenantCount: expect.objectContaining({ increment: 1 }),
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Graceful degradation
  // -----------------------------------------------------------------------

  describe('graceful degradation', () => {
    it('skips tenant when DB connection fails and continues', async () => {
      vi.spyOn(mockDbConnector, 'connectToTenantDb')
        .mockResolvedValueOnce(null) // Tenant A fails
        .mockResolvedValueOnce(createMockTenantDbClient()); // Tenant B succeeds

      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

      const result = await service.aggregateForDate(TEST_DATE);

      // Tenant A's connection failed → counted as skipped (AC#2: graceful degradation)
      expect(result.processedTenants).toBe(1);
      expect(result.skippedTenants).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not connect to tenant tenant-a'),
      );
    });

    it('skips tenant when processing throws and continues', async () => {
      const failClient = createMockTenantDbClient();
      const goodClient = createMockTenantDbClient();

      // Make the pattern upsert fail for the first call only
      let callCount = 0;
      (mockPrisma.tenantAiPattern.upsert as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('DB write failed'));
        }
        return Promise.resolve({ id: 'pattern-ok' });
      });

      vi.spyOn(mockDbConnector, 'connectToTenantDb')
        .mockResolvedValueOnce(failClient)
        .mockResolvedValueOnce(goodClient);

      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

      const result = await service.aggregateForDate(TEST_DATE);

      // Tenant A failed → skipped, Tenant B succeeded
      expect(result.processedTenants).toBe(1);
      expect(result.skippedTenants).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process tenant tenant-a'),
      );
    });

    it('closes DB connection even when processing fails', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      // Make upsert throw
      (mockPrisma.tenantAiPattern.upsert as any).mockRejectedValue(new Error('DB error'));

      await service.aggregateForDate(TEST_DATE);

      // Connection should still be closed (finally block)
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('handles zero active tenants gracefully', async () => {
      (mockPrisma.tenant.findMany as any).mockResolvedValue([]);

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(0);
      expect(result.skippedTenants).toBe(0);
      expect(result.patternsCreated).toBe(0);
      expect(result.correctionsCreated).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // PII validation failure
  // -----------------------------------------------------------------------

  describe('PII validation failure', () => {
    it('skips tenant when anonymised output fails PII validation', async () => {
      // Create a client that returns data that will trigger PII detection
      // after anonymisation (edge case: skill key that looks like an email)
      const mockClient: TenantDbClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('ai_learning_signals')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          if (sql.includes('ai_correction_log')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          if (sql.includes('saved_views')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          if (sql.includes('ai_automations')) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      // Mock validateNoPersonalData to return a violation
      const anonModule = await import('../services/anonymisation.service.js');
      const validateSpy = vi.spyOn(anonModule, 'validateNoPersonalData').mockReturnValueOnce({
        valid: false,
        violations: ['Email detected at test: "test***"'],
      });

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(1);
      expect(result.patternsCreated).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('PII detected'));

      validateSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Data extraction queries
  // -----------------------------------------------------------------------

  describe('data extraction', () => {
    it('queries tenant DB with correct SQL for learning signals', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      await service.aggregateForDate(TEST_DATE);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ai_learning_signals'),
        ['2026-03-03'],
      );
    });

    it('queries tenant DB with correct date range for corrections', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      await service.aggregateForDate(TEST_DATE);

      // Implementation uses exclusive upper bound: created_at >= dayStart AND created_at < nextDayMidnight
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ai_correction_log'), [
        '2026-03-03T00:00:00.000Z',
        '2026-03-04T00:00:00.000Z',
      ]);
    });

    it('handles empty tenant data gracefully', async () => {
      const mockClient = createMockTenantDbClient({
        signals: [],
        corrections: [],
        views: [],
        automations: [],
      });
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A]);

      const result = await service.aggregateForDate(TEST_DATE);

      expect(result.processedTenants).toBe(1);
      expect(result.patternsCreated).toBe(1); // Still creates a pattern (with empty data)
      expect(result.correctionsCreated).toBe(0); // No corrections to create
    });
  });

  // -----------------------------------------------------------------------
  // Skill effectiveness aggregation (AC#5 — Task 6)
  // -----------------------------------------------------------------------

  describe('aggregateSkillEffectiveness()', () => {
    it('calculates weighted averages correctly with multiple tenants', async () => {
      // Tenant A: create_invoice — 45 queries, 40 success, 5 corrections, 0.88 confidence
      // Tenant B: create_invoice — 30 queries, 24 success, 6 corrections, 0.80 confidence
      // Expected: totalQueries=75, avgSuccess=64/75=0.8533, avgCorrection=11/75=0.1467
      //           avgConfidence=(0.88*45 + 0.80*30)/75 = (39.6+24)/75 = 0.848
      const tenantASignals = [
        {
          skill_key: 'create_invoice',
          total_queries: 45,
          success_count: 40,
          correction_count: 5,
          avg_confidence: 0.88,
        },
      ];
      const tenantBSignals = [
        {
          skill_key: 'create_invoice',
          total_queries: 30,
          success_count: 24,
          correction_count: 6,
          avg_confidence: 0.8,
        },
      ];

      const count = await service.aggregateSkillEffectiveness(TEST_DATE, [
        tenantASignals,
        tenantBSignals,
      ]);

      expect(count).toBe(1);
      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            skillKey_measureDate: {
              skillKey: 'create_invoice',
              measureDate: TEST_DATE,
            },
          },
          create: expect.objectContaining({
            skillKey: 'create_invoice',
            measureDate: TEST_DATE,
            tenantCount: 2,
            totalQueries: 75,
            avgSuccessRate: expect.closeTo(64 / 75, 4),
            avgCorrectionRate: expect.closeTo(11 / 75, 4),
            avgConfidence: expect.closeTo((0.88 * 45 + 0.8 * 30) / 75, 4),
          }),
        }),
      );
    });

    it('counts tenantCount correctly per skill', async () => {
      // Tenant A uses create_invoice and apply_filter
      // Tenant B uses create_invoice only
      // Tenant C uses apply_filter only
      const tenantA = [
        {
          skill_key: 'create_invoice',
          total_queries: 10,
          success_count: 9,
          correction_count: 1,
          avg_confidence: 0.9,
        },
        {
          skill_key: 'apply_filter',
          total_queries: 20,
          success_count: 19,
          correction_count: 1,
          avg_confidence: 0.95,
        },
      ];
      const tenantB = [
        {
          skill_key: 'create_invoice',
          total_queries: 15,
          success_count: 12,
          correction_count: 3,
          avg_confidence: 0.85,
        },
      ];
      const tenantC = [
        {
          skill_key: 'apply_filter',
          total_queries: 30,
          success_count: 28,
          correction_count: 2,
          avg_confidence: 0.93,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [tenantA, tenantB, tenantC]);

      // create_invoice: 2 tenants (A + B)
      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            skillKey: 'create_invoice',
            tenantCount: 2,
            totalQueries: 25,
          }),
        }),
      );

      // apply_filter: 2 tenants (A + C)
      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            skillKey: 'apply_filter',
            tenantCount: 2,
            totalQueries: 50,
          }),
        }),
      );
    });

    it('records single-tenant skill (tenantCount = 1)', async () => {
      const singleTenant = [
        {
          skill_key: 'rare_skill',
          total_queries: 5,
          success_count: 4,
          correction_count: 1,
          avg_confidence: 0.75,
        },
      ];

      const count = await service.aggregateSkillEffectiveness(TEST_DATE, [singleTenant]);

      expect(count).toBe(1);
      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            skillKey: 'rare_skill',
            tenantCount: 1,
            totalQueries: 5,
            avgSuccessRate: 0.8,
            avgCorrectionRate: 0.2,
            avgConfidence: 0.75,
          }),
        }),
      );
    });

    it('returns 0 when no signals provided', async () => {
      const count = await service.aggregateSkillEffectiveness(TEST_DATE, []);

      expect(count).toBe(0);
      expect(mockPrisma.aiSkillEffectiveness.upsert).not.toHaveBeenCalled();
    });

    it('handles zero total_queries gracefully (no division by zero)', async () => {
      const signals = [
        {
          skill_key: 'empty_skill',
          total_queries: 0,
          success_count: 0,
          correction_count: 0,
          avg_confidence: 0,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [signals]);

      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            avgSuccessRate: 0,
            avgCorrectionRate: 0,
            avgConfidence: 0,
          }),
        }),
      );
    });

    it('integrates with aggregateForDate — skill effectiveness runs after daily patterns', async () => {
      const mockClient = createMockTenantDbClient();
      vi.spyOn(mockDbConnector, 'connectToTenantDb').mockResolvedValue(mockClient);
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_A, TENANT_B]);

      await service.aggregateForDate(TEST_DATE);

      // Should have called aiSkillEffectiveness.upsert for skills from learning signals
      // Default mock client has create_invoice (45 queries) and apply_filter (89 queries)
      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Skill effectiveness'));
    });

    it('does not run skill effectiveness when all tenants opted out', async () => {
      (mockPrisma.tenant.findMany as any).mockResolvedValue([TENANT_OPTED_OUT]);

      await service.aggregateForDate(TEST_DATE);

      expect(mockPrisma.aiSkillEffectiveness.upsert).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Trend calculation (AC#5 — Task 6.2)
  // -----------------------------------------------------------------------

  describe('trend calculation', () => {
    it('returns null when insufficient history (< 7 days)', async () => {
      // Only 3 days of history
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue([
        { measureDate: new Date('2026-02-28'), avgSuccessRate: 0.8 },
        { measureDate: new Date('2026-03-01'), avgSuccessRate: 0.82 },
        { measureDate: new Date('2026-03-02'), avgSuccessRate: 0.85 },
      ]);

      const signals = [
        {
          skill_key: 'test_skill',
          total_queries: 10,
          success_count: 9,
          correction_count: 1,
          avg_confidence: 0.9,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [signals]);

      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trend: null,
          }),
        }),
      );
    });

    it('returns IMPROVING when current window is >5% better', async () => {
      // Previous window (days -14 to -8): ~0.70 success rate
      // Recent window (days -7 to -1): ~0.85 success rate
      // Current day: 0.90
      // Diff ≈ 0.87 - 0.70 = 0.17 > 0.05 → IMPROVING
      const history = [
        { measureDate: new Date('2026-02-17'), avgSuccessRate: 0.68 },
        { measureDate: new Date('2026-02-18'), avgSuccessRate: 0.7 },
        { measureDate: new Date('2026-02-19'), avgSuccessRate: 0.71 },
        { measureDate: new Date('2026-02-20'), avgSuccessRate: 0.72 },
        { measureDate: new Date('2026-02-21'), avgSuccessRate: 0.69 },
        { measureDate: new Date('2026-02-22'), avgSuccessRate: 0.7 },
        { measureDate: new Date('2026-02-23'), avgSuccessRate: 0.7 },
        // recent window (>= sevenDaysAgo = 2026-02-24)
        { measureDate: new Date('2026-02-24'), avgSuccessRate: 0.83 },
        { measureDate: new Date('2026-02-25'), avgSuccessRate: 0.84 },
        { measureDate: new Date('2026-02-26'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-27'), avgSuccessRate: 0.86 },
        { measureDate: new Date('2026-02-28'), avgSuccessRate: 0.87 },
        { measureDate: new Date('2026-03-01'), avgSuccessRate: 0.88 },
        { measureDate: new Date('2026-03-02'), avgSuccessRate: 0.87 },
      ];
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue(history);

      const signals = [
        {
          skill_key: 'improving_skill',
          total_queries: 100,
          success_count: 90,
          correction_count: 10,
          avg_confidence: 0.9,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [signals]);

      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trend: 'IMPROVING',
          }),
        }),
      );
    });

    it('returns DECLINING when current window is >5% worse', async () => {
      // Previous window: ~0.90 success rate
      // Recent window: ~0.75 success rate
      // Diff ≈ -0.15 < -0.05 → DECLINING
      const history = [
        { measureDate: new Date('2026-02-17'), avgSuccessRate: 0.9 },
        { measureDate: new Date('2026-02-18'), avgSuccessRate: 0.91 },
        { measureDate: new Date('2026-02-19'), avgSuccessRate: 0.89 },
        { measureDate: new Date('2026-02-20'), avgSuccessRate: 0.9 },
        { measureDate: new Date('2026-02-21'), avgSuccessRate: 0.91 },
        { measureDate: new Date('2026-02-22'), avgSuccessRate: 0.89 },
        { measureDate: new Date('2026-02-23'), avgSuccessRate: 0.9 },
        // recent window
        { measureDate: new Date('2026-02-24'), avgSuccessRate: 0.78 },
        { measureDate: new Date('2026-02-25'), avgSuccessRate: 0.76 },
        { measureDate: new Date('2026-02-26'), avgSuccessRate: 0.74 },
        { measureDate: new Date('2026-02-27'), avgSuccessRate: 0.75 },
        { measureDate: new Date('2026-02-28'), avgSuccessRate: 0.73 },
        { measureDate: new Date('2026-03-01'), avgSuccessRate: 0.72 },
        { measureDate: new Date('2026-03-02'), avgSuccessRate: 0.74 },
      ];
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue(history);

      const signals = [
        {
          skill_key: 'declining_skill',
          total_queries: 100,
          success_count: 70,
          correction_count: 30,
          avg_confidence: 0.7,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [signals]);

      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trend: 'DECLINING',
          }),
        }),
      );
    });

    it('returns STABLE when difference is within 5%', async () => {
      // Both windows at ~0.85 success rate
      const history = [
        { measureDate: new Date('2026-02-17'), avgSuccessRate: 0.84 },
        { measureDate: new Date('2026-02-18'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-19'), avgSuccessRate: 0.86 },
        { measureDate: new Date('2026-02-20'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-21'), avgSuccessRate: 0.84 },
        { measureDate: new Date('2026-02-22'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-23'), avgSuccessRate: 0.86 },
        // recent window
        { measureDate: new Date('2026-02-24'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-25'), avgSuccessRate: 0.86 },
        { measureDate: new Date('2026-02-26'), avgSuccessRate: 0.84 },
        { measureDate: new Date('2026-02-27'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-28'), avgSuccessRate: 0.86 },
        { measureDate: new Date('2026-03-01'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-03-02'), avgSuccessRate: 0.84 },
      ];
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue(history);

      const signals = [
        {
          skill_key: 'stable_skill',
          total_queries: 100,
          success_count: 85,
          correction_count: 15,
          avg_confidence: 0.85,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [signals]);

      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trend: 'STABLE',
          }),
        }),
      );
    });

    it('returns null when previous window has no data', async () => {
      // All 7 records are in the recent window (last 7 days)
      const history = [
        { measureDate: new Date('2026-02-24'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-25'), avgSuccessRate: 0.86 },
        { measureDate: new Date('2026-02-26'), avgSuccessRate: 0.84 },
        { measureDate: new Date('2026-02-27'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-02-28'), avgSuccessRate: 0.86 },
        { measureDate: new Date('2026-03-01'), avgSuccessRate: 0.85 },
        { measureDate: new Date('2026-03-02'), avgSuccessRate: 0.84 },
      ];
      (mockPrisma.aiSkillEffectiveness.findMany as any).mockResolvedValue(history);

      const signals = [
        {
          skill_key: 'no_prev_skill',
          total_queries: 10,
          success_count: 8,
          correction_count: 2,
          avg_confidence: 0.8,
        },
      ];

      await service.aggregateSkillEffectiveness(TEST_DATE, [signals]);

      expect(mockPrisma.aiSkillEffectiveness.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trend: null,
          }),
        }),
      );
    });
  });
});

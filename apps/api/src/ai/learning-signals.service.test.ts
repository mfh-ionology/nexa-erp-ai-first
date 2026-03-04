// ---------------------------------------------------------------------------
// Unit tests for LearningSignalsService — E5d-2 Task 8.7
// Tests: aggregation upsert, high correction rate detection, low-sample
// exclusion, event emission
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockEventBus } = vi.hoisted(() => ({
  mockPrisma: {
    aiCorrectionLog: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    aiConversation: {
      findMany: vi.fn(),
    },
    aiMessage: {
      count: vi.fn(),
    },
    aiLearningSignal: {
      upsert: vi.fn(),
      groupBy: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { LearningSignalsService } from './learning-signals.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';

function createService() {
  return new LearningSignalsService(mockPrisma as any, mockLogger as any, mockEventBus as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LearningSignalsService', () => {
  let service: LearningSignalsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // aggregateForDate
  // ═══════════════════════════════════════════════════════════════════════

  describe('aggregateForDate()', () => {
    it('returns zero counts when no AI activity exists on date', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue([]);
      mockPrisma.aiConversation.findMany.mockResolvedValue([]);

      const result = await service.aggregateForDate(new Date('2026-03-01'));

      expect(result.processedCompanies).toBe(0);
      expect(result.signalsCreated).toBe(0);
    });

    it('processes companies with corrections', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue([{ companyId: TEST_COMPANY_ID }]);
      mockPrisma.aiConversation.findMany.mockResolvedValue([]);

      // For aggregateForCompany
      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([
        { skillKey: 'create_invoice', _count: { id: 2 } },
      ]);
      mockPrisma.aiMessage.count.mockResolvedValue(10);
      mockPrisma.aiLearningSignal.upsert.mockResolvedValue({});
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([]);

      const result = await service.aggregateForDate(new Date('2026-03-01'));

      expect(result.processedCompanies).toBe(1);
      expect(result.signalsCreated).toBe(1);
    });

    it('deduplicates companies that appear in both corrections and conversations', async () => {
      mockPrisma.aiCorrectionLog.findMany.mockResolvedValue([{ companyId: TEST_COMPANY_ID }]);
      mockPrisma.aiConversation.findMany.mockResolvedValue([
        { companyId: TEST_COMPANY_ID }, // same company
      ]);

      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([
        { skillKey: 'create_invoice', _count: { id: 1 } },
      ]);
      mockPrisma.aiMessage.count.mockResolvedValue(5);
      mockPrisma.aiLearningSignal.upsert.mockResolvedValue({});
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([]);

      const result = await service.aggregateForDate(new Date('2026-03-01'));

      // Should only process the company once
      expect(result.processedCompanies).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // aggregateForCompany — upsert signal rows
  // ═══════════════════════════════════════════════════════════════════════

  describe('aggregateForCompany()', () => {
    it('upserts signal rows per skill/company/date', async () => {
      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([
        { skillKey: 'create_invoice', _count: { id: 3 } },
        { skillKey: 'search_contacts', _count: { id: 1 } },
      ]);
      mockPrisma.aiMessage.count.mockResolvedValue(20);
      mockPrisma.aiLearningSignal.upsert.mockResolvedValue({});
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([]);

      const signalsCreated = await service.aggregateForCompany(
        TEST_COMPANY_ID,
        new Date('2026-03-01'),
      );

      expect(signalsCreated).toBe(2);
      expect(mockPrisma.aiLearningSignal.upsert).toHaveBeenCalledTimes(2);
    });

    it('ensures totalQueries >= correctionCount per skill', async () => {
      // 15 corrections but only 5 total messages → totalQueries must be at least 15
      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([
        { skillKey: 'broken_skill', _count: { id: 15 } },
      ]);
      mockPrisma.aiMessage.count.mockResolvedValue(5);
      mockPrisma.aiLearningSignal.upsert.mockResolvedValue({});
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([]);

      await service.aggregateForCompany(TEST_COMPANY_ID, new Date('2026-03-01'));

      const upsertCall = mockPrisma.aiLearningSignal.upsert.mock.calls[0]![0];
      expect(upsertCall.create.totalQueries).toBeGreaterThanOrEqual(15);
      expect(upsertCall.create.correctionCount).toBe(15);
      expect(upsertCall.create.successCount).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 when no corrections and no messages exist', async () => {
      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([]);
      mockPrisma.aiMessage.count.mockResolvedValue(0);

      const result = await service.aggregateForCompany(TEST_COMPANY_ID, new Date('2026-03-01'));

      expect(result).toBe(0);
      expect(mockPrisma.aiLearningSignal.upsert).not.toHaveBeenCalled();
    });

    it('returns 0 when messages exist but no corrections with skill attribution', async () => {
      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([]);
      mockPrisma.aiMessage.count.mockResolvedValue(10);

      const result = await service.aggregateForCompany(TEST_COMPANY_ID, new Date('2026-03-01'));

      expect(result).toBe(0);
    });

    it('uses correct unique constraint for upsert', async () => {
      mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([
        { skillKey: 'create_invoice', _count: { id: 2 } },
      ]);
      mockPrisma.aiMessage.count.mockResolvedValue(10);
      mockPrisma.aiLearningSignal.upsert.mockResolvedValue({});
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([]);

      await service.aggregateForCompany(TEST_COMPANY_ID, new Date('2026-03-01'));

      expect(mockPrisma.aiLearningSignal.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId_skillKey_signalDate: expect.objectContaining({
              companyId: TEST_COMPANY_ID,
              skillKey: 'create_invoice',
            }),
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // checkHighCorrectionRates — threshold + alerts
  // ═══════════════════════════════════════════════════════════════════════

  describe('checkHighCorrectionRates()', () => {
    it('emits event when correction rate >30% and >=10 queries', async () => {
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([
        {
          skillKey: 'bad_skill',
          _sum: { totalQueries: 20, correctionCount: 8, successCount: 12 },
        },
      ]);

      await service.checkHighCorrectionRates(TEST_COMPANY_ID);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.learning.signalAggregated',
        expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          skillKey: 'bad_skill',
        }),
      );
    });

    it('logs warning for high correction rate', async () => {
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([
        {
          skillKey: 'bad_skill',
          _sum: { totalQueries: 20, correctionCount: 10, successCount: 10 },
        },
      ]);

      await service.checkHighCorrectionRates(TEST_COMPANY_ID);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          skillKey: 'bad_skill',
          companyId: TEST_COMPANY_ID,
        }),
        expect.stringContaining('correction rate'),
      );
    });

    it('does not emit when correction rate <=30%', async () => {
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([
        {
          skillKey: 'good_skill',
          _sum: { totalQueries: 20, correctionCount: 4, successCount: 16 },
        },
      ]);

      await service.checkHighCorrectionRates(TEST_COMPANY_ID);

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('excludes skills with <10 total queries (low sample)', async () => {
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([
        {
          skillKey: 'low_sample_skill',
          _sum: { totalQueries: 5, correctionCount: 4, successCount: 1 },
          // 80% correction rate but only 5 queries → skip
        },
      ]);

      await service.checkHighCorrectionRates(TEST_COMPANY_ID);

      expect(mockEventBus.emit).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('includes correctionRate and successRate in event payload', async () => {
      mockPrisma.aiLearningSignal.groupBy.mockResolvedValue([
        {
          skillKey: 'alert_skill',
          _sum: { totalQueries: 10, correctionCount: 5, successCount: 5 },
        },
      ]);

      await service.checkHighCorrectionRates(TEST_COMPANY_ID);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.learning.signalAggregated',
        expect.objectContaining({
          correctionRate: 0.5,
          successRate: 0.5,
        }),
      );
    });
  });
});

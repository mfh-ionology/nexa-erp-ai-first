import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockOrchestrator } = vi.hoisted(() => ({
  mockPrisma: {
    // Dynamic model access for safeModelQuery
    bankAccount: {
      findMany: vi.fn(),
    },
    customerInvoice: {
      findMany: vi.fn(),
    },
    supplierInvoice: {
      findMany: vi.fn(),
    },
    purchaseOrder: {
      findMany: vi.fn(),
    },
    recurringPayment: {
      findMany: vi.fn(),
    },
    // Transaction / entity models for anomaly & duplicate detection
    payment: {
      findMany: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
    },
    // AiMessage model for confidence scoring
    aiMessage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  } as Record<string, any>,
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockOrchestrator: {
    process: vi.fn(),
    processDirect: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { PredictionService } from './prediction.service.js';
import type { AiRequestContext, CashFlowPeriod } from './ai.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new PredictionService(
    mockOrchestrator as any,
    mockPrisma as any,
    mockLogger as any,
  );
}

const baseContext: AiRequestContext = {
  userId: 'user-1',
  companyId: 'company-1',
  tenantId: 'tenant-1',
  locale: 'en-GB',
};

function makePeriod(overrides: Partial<CashFlowPeriod> = {}): CashFlowPeriod {
  return {
    periodStart: '2026-03-01',
    periodEnd: '2026-03-07',
    openingBalance: '10000.0000',
    inflows: '5000.0000',
    outflows: '3000.0000',
    netFlow: '2000.0000',
    closingBalance: '12000.0000',
    inflowDetails: [],
    outflowDetails: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PredictionService', () => {
  let service: PredictionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── forecastCashFlow ───────────────────────────────────────────────────

  describe('forecastCashFlow()', () => {
    it('calls orchestrator with intent "forecast" and routing tags ["reasoning"]', async () => {
      // All models not available — graceful degradation
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({ periods: [] }),
      });

      await service.forecastCashFlow({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: true,
        includeRecurring: true,
        context: baseContext,
      });

      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.intent).toBe('forecast');
      expect(call.routingTags).toEqual(['reasoning']);

      expect(call.context).toEqual(baseContext);
    });

    it('includes financial context in user message', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '25000.0000', currency: 'GBP' },
      ]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({ periods: [] }),
      });

      await service.forecastCashFlow({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: false,
        includeRecurring: false,
        context: baseContext,
      });

      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.userMessage).toContain('25000.0000');
      expect(call.userMessage).toContain('GBP');
      expect(call.userMessage).toContain('2026-03-01');
      expect(call.userMessage).toContain('2026-03-31');
    });

    it('returns parsed periods with correct types', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          periods: [
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '10000.0000',
              inflows: '5000.0000',
              outflows: '3000.0000',
              netFlow: '2000.0000',
              closingBalance: '12000.0000',
              inflowDetails: [{ source: 'AR', amount: '5000.0000', description: 'Customer payments' }],
              outflowDetails: [{ source: 'AP', amount: '3000.0000', description: 'Supplier payments' }],
            },
          ],
        }),
      });

      const result = await service.forecastCashFlow({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: true,
        includeRecurring: true,
        context: baseContext,
      });

      expect(result.periods).toHaveLength(1);
      expect(result.periods[0]!.periodStart).toBe('2026-03-01');
      expect(result.periods[0]!.closingBalance).toBe('12000.0000');
      expect(result.periods[0]!.inflowDetails).toHaveLength(1);
      expect(result.periods[0]!.outflowDetails).toHaveLength(1);
      expect(result.currency).toBe('GBP');
      expect(result.generatedAt).toBeDefined();
    });

    it('generates NEGATIVE_BALANCE alert for negative closing balance', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          periods: [
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '1000.0000',
              inflows: '500.0000',
              outflows: '2000.0000',
              netFlow: '-1500.0000',
              closingBalance: '-500.0000',
              inflowDetails: [],
              outflowDetails: [],
            },
          ],
        }),
      });

      const result = await service.forecastCashFlow({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: true,
        includeRecurring: true,
        context: baseContext,
      });

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]!.type).toBe('NEGATIVE_BALANCE');
      expect(result.alerts[0]!.amount).toBe('-500.0000');
      expect(result.alerts[0]!.suggestedAction).toBeDefined();
    });

    it('generates LOW_BALANCE alert when closing balance drops below threshold', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          periods: [
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '10000.0000',
              inflows: '100.0000',
              outflows: '9200.0000',
              netFlow: '-9100.0000',
              closingBalance: '900.0000',
              inflowDetails: [],
              outflowDetails: [],
            },
          ],
        }),
      });

      const result = await service.forecastCashFlow({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: true,
        includeRecurring: true,
        context: baseContext,
      });

      expect(result.alerts.some((a) => a.type === 'LOW_BALANCE')).toBe(true);
      const lowAlert = result.alerts.find((a) => a.type === 'LOW_BALANCE')!;
      expect(lowAlert.amount).toBe('900.0000');
    });
  });

  // ─── gatherFinancialContext ─────────────────────────────────────────────

  describe('gatherFinancialContext()', () => {
    it('scopes all queries by companyId', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.recurringPayment.findMany.mockResolvedValue([]);

      await (service as any).gatherFinancialContext({
        companyId: 'company-123',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: true,
        includeRecurring: true,
      });

      // All queries should be scoped by companyId
      for (const model of [
        mockPrisma.bankAccount,
        mockPrisma.customerInvoice,
        mockPrisma.supplierInvoice,
        mockPrisma.purchaseOrder,
        mockPrisma.recurringPayment,
      ]) {
        const whereArg = model.findMany.mock.calls[0]?.[0]?.where;
        expect(whereArg?.companyId).toBe('company-123');
      }
    });

    it('degrades gracefully when business module models do not exist', async () => {
      // Simulate models not existing by removing them from mock
      const prismaWithoutModels = {
        bankAccount: { findMany: vi.fn().mockResolvedValue([]) },
        // No customerInvoice, supplierInvoice, purchaseOrder, recurringPayment
      };

      const serviceWithLimitedDb = new PredictionService(
        mockOrchestrator as any,
        prismaWithoutModels as any,
        mockLogger as any,
      );

      const result = await (serviceWithLimitedDb as any).gatherFinancialContext({
        companyId: 'company-1',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: true,
        includeRecurring: true,
      });

      // Should return default values with empty arrays
      expect(result.currentBalance).toBe('0.0000');
      expect(result.currency).toBe('GBP');
      expect(result.arOutstanding).toEqual([]);
      expect(result.apOutstanding).toEqual([]);
      expect(result.committedPOs).toEqual([]);
      expect(result.recurringPayments).toEqual([]);

      // Should log warnings for missing models
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns bank account balance and currency', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '15000.0000', currency: 'GBP' },
        { id: 'ba-2', balance: '5000.0000', currency: 'GBP' },
      ]);

      const result = await (service as any).gatherFinancialContext({
        companyId: 'company-1',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: false,
        includeRecurring: false,
      });

      expect(result.currentBalance).toBe('20000.0000');
      expect(result.currency).toBe('GBP');
    });

    it('only sums same-currency bank accounts — skips non-primary currency accounts', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '15000.0000', currency: 'GBP' },
        { id: 'ba-2', balance: '5000.0000', currency: 'GBP' },
        { id: 'ba-3', balance: '10000.0000', currency: 'EUR' },
      ]);

      const result = await (service as any).gatherFinancialContext({
        companyId: 'company-1',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: false,
        includeRecurring: false,
      });

      // Should only sum GBP accounts (15000 + 5000 = 20000), not EUR
      expect(result.currentBalance).toBe('20000.0000');
      expect(result.currency).toBe('GBP');
      // Should log warning about skipped EUR account
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ skippedCount: 1, primaryCurrency: 'GBP' }),
        expect.stringContaining('Skipped 1 bank account(s) with different currency'),
      );
    });

    it('skips PO queries when includeCommittedPOs is false', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);

      await (service as any).gatherFinancialContext({
        companyId: 'company-1',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: false,
        includeRecurring: false,
      });

      expect(mockPrisma.purchaseOrder.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.recurringPayment.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── parseForecastResponse ──────────────────────────────────────────────

  describe('parseForecastResponse()', () => {
    it('handles malformed JSON gracefully', () => {
      const result = (service as any).parseForecastResponse(
        'not valid json at all',
        'GBP',
        '10000.0000',
      );

      expect(result.periods).toEqual([]);
      expect(result.currency).toBe('GBP');
      expect(result.currentBalance).toBe('10000.0000');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to parse AI forecast response as JSON — returning empty forecast',
      );
    });

    it('skips invalid periods and logs warnings', () => {
      const result = (service as any).parseForecastResponse(
        JSON.stringify({
          periods: [
            { periodStart: '2026-03-01' }, // missing required fields
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '10000.0000',
              inflows: '5000.0000',
              outflows: '3000.0000',
              netFlow: '2000.0000',
              closingBalance: '12000.0000',
            },
          ],
        }),
        'GBP',
        '10000.0000',
      );

      expect(result.periods).toHaveLength(1);
      expect(result.periods[0]!.closingBalance).toBe('12000.0000');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ raw: expect.any(Object) }),
        'Skipping malformed forecast period — missing required fields',
      );
    });

    it('parses periods from root array', () => {
      const result = (service as any).parseForecastResponse(
        JSON.stringify([
          {
            periodStart: '2026-03-01',
            periodEnd: '2026-03-07',
            openingBalance: '1000.0000',
            inflows: '500.0000',
            outflows: '200.0000',
            netFlow: '300.0000',
            closingBalance: '1300.0000',
          },
        ]),
        'GBP',
        '1000.0000',
      );

      expect(result.periods).toHaveLength(1);
      expect(result.periods[0]!.periodStart).toBe('2026-03-01');
    });

    it('handles empty periods array', () => {
      const result = (service as any).parseForecastResponse(
        JSON.stringify({ periods: [] }),
        'EUR',
        '5000.0000',
      );

      expect(result.periods).toEqual([]);
      expect(result.currency).toBe('EUR');
    });
  });

  // ─── generateAlerts ─────────────────────────────────────────────────────

  describe('generateAlerts()', () => {
    it('returns empty array when all balances are positive', () => {
      const periods: CashFlowPeriod[] = [
        makePeriod({ openingBalance: '10000.0000', closingBalance: '12000.0000' }),
        makePeriod({ openingBalance: '12000.0000', closingBalance: '15000.0000' }),
      ];

      const alerts = (service as any).generateAlerts(periods);
      expect(alerts).toEqual([]);
    });

    it('generates NEGATIVE_BALANCE alert', () => {
      const periods: CashFlowPeriod[] = [
        makePeriod({
          openingBalance: '1000.0000',
          closingBalance: '-500.0000',
          inflows: '200.0000',
          outflows: '1700.0000',
        }),
      ];

      const alerts = (service as any).generateAlerts(periods);
      expect(alerts.some((a: any) => a.type === 'NEGATIVE_BALANCE')).toBe(true);
      expect(alerts.find((a: any) => a.type === 'NEGATIVE_BALANCE')!.amount).toBe('-500.0000');
    });

    it('generates LOW_BALANCE alert when below 10% of opening', () => {
      const periods: CashFlowPeriod[] = [
        makePeriod({
          openingBalance: '10000.0000',
          closingBalance: '800.0000',
          inflows: '100.0000',
          outflows: '9300.0000',
        }),
      ];

      const alerts = (service as any).generateAlerts(periods);
      expect(alerts.some((a: any) => a.type === 'LOW_BALANCE')).toBe(true);
    });

    it('does not generate LOW_BALANCE when opening balance is zero or negative', () => {
      const periods: CashFlowPeriod[] = [
        makePeriod({
          openingBalance: '0.0000',
          closingBalance: '0.0000',
          inflows: '0.0000',
          outflows: '0.0000',
          netFlow: '0.0000',
        }),
      ];

      const alerts = (service as any).generateAlerts(periods);
      expect(alerts.some((a: any) => a.type === 'LOW_BALANCE')).toBe(false);
    });

    it('generates COLLECTION_OPPORTUNITY when inflows exceed outflows by 150%', () => {
      const periods: CashFlowPeriod[] = [
        makePeriod({
          openingBalance: '10000.0000',
          closingBalance: '18000.0000',
          inflows: '12000.0000',
          outflows: '4000.0000',
          inflowDetails: [{ source: 'AR', amount: '12000.0000', description: 'Customer payments' }],
        }),
      ];

      const alerts = (service as any).generateAlerts(periods);
      expect(alerts.some((a: any) => a.type === 'COLLECTION_OPPORTUNITY')).toBe(true);
    });

    it('does not generate COLLECTION_OPPORTUNITY when inflows have no details', () => {
      const periods: CashFlowPeriod[] = [
        makePeriod({
          inflows: '12000.0000',
          outflows: '4000.0000',
          inflowDetails: [], // no details
        }),
      ];

      const alerts = (service as any).generateAlerts(periods);
      expect(alerts.some((a: any) => a.type === 'COLLECTION_OPPORTUNITY')).toBe(false);
    });

    it('returns empty array for empty periods', () => {
      expect((service as any).generateAlerts([])).toEqual([]);
    });
  });

  // ─── detectAnomalies ────────────────────────────────────────────────────

  describe('detectAnomalies()', () => {
    it('calls orchestrator with intent "anomaly-detect" and routing tags ["reasoning"]', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({ anomalies: [] }),
      });

      await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.intent).toBe('anomaly-detect');
      expect(call.routingTags).toEqual(['reasoning']);

      expect(call.context).toEqual(baseContext);
    });

    it('filters results below minConfidence', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-1',
              displayRef: 'PAY-001',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'Duplicate payment detected',
              confidence: 0.95,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-2',
              displayRef: 'PAY-002',
              anomalyType: 'ROUND_NUMBER_BIAS',
              description: 'Round number pattern',
              confidence: 0.3,
              metadata: {},
            },
          ],
        }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0]!.entityId).toBe('pay-1');
    });

    it('applies confidenceLevel correctly (>=0.9 high, >=0.7 review, <0.7 low)', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-1',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'High confidence anomaly',
              confidence: 0.95,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-2',
              anomalyType: 'UNUSUAL_AMOUNT',
              description: 'Review confidence anomaly',
              confidence: 0.75,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-3',
              anomalyType: 'TIMING_ANOMALY',
              description: 'Low confidence anomaly',
              confidence: 0.55,
              metadata: {},
            },
          ],
        }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.anomalies).toHaveLength(3);
      expect(result.anomalies[0]!.confidenceLevel).toBe('high');
      expect(result.anomalies[1]!.confidenceLevel).toBe('review');
      expect(result.anomalies[2]!.confidenceLevel).toBe('low');
    });

    it('returns results sorted by confidence descending', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-low',
              anomalyType: 'TIMING_ANOMALY',
              description: 'Low',
              confidence: 0.6,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-high',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'High',
              confidence: 0.95,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-mid',
              anomalyType: 'UNUSUAL_AMOUNT',
              description: 'Mid',
              confidence: 0.8,
              metadata: {},
            },
          ],
        }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.anomalies[0]!.confidence).toBe(0.95);
      expect(result.anomalies[1]!.confidence).toBe(0.8);
      expect(result.anomalies[2]!.confidence).toBe(0.6);
    });

    it('handles malformed AI response gracefully', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'not valid json',
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.anomalies).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to parse AI anomaly response as JSON — returning empty results',
      );
    });

    it('skips malformed anomaly entries and logs warnings', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          anomalies: [
            { entityType: 'Payment' }, // missing required fields
            {
              entityType: 'Payment',
              entityId: 'pay-1',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'Valid anomaly',
              confidence: 0.85,
              metadata: {},
            },
          ],
        }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0]!.entityId).toBe('pay-1');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ raw: expect.any(Object) }),
        'Skipping malformed anomaly result — missing required fields',
      );
    });

    it('rejects anomalies with invalid anomalyType enum values', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-1',
              anomalyType: 'PHANTOM_VENDOR', // not a valid enum value
              description: 'Invalid anomaly type',
              confidence: 0.85,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-2',
              anomalyType: 'DUPLICATE_AMOUNT', // valid
              description: 'Valid anomaly',
              confidence: 0.90,
              metadata: {},
            },
          ],
        }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      // Only the valid anomaly should pass through
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0]!.anomalyType).toBe('DUPLICATE_AMOUNT');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ raw: expect.any(Object) }),
        'Skipping malformed anomaly result — missing required fields',
      );
    });

    it('includes related entities when present', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-1',
              displayRef: 'PAY-001',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'Duplicate payment to same supplier',
              confidence: 0.92,
              relatedEntities: [
                {
                  entityType: 'Payment',
                  entityId: 'pay-2',
                  displayRef: 'PAY-002',
                  relationship: 'original_payment',
                },
              ],
              metadata: { duplicateAmount: '5000.0000' },
            },
          ],
        }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.anomalies[0]!.relatedEntities).toHaveLength(1);
      expect(result.anomalies[0]!.relatedEntities![0]!.relationship).toBe('original_payment');
      expect(result.anomalies[0]!.metadata).toEqual({ duplicateAmount: '5000.0000' });
    });

    it('returns totalAnalysed from transaction context', async () => {
      // Set up payment model to return data
      mockPrisma.payment = { findMany: vi.fn().mockResolvedValue([
        { id: 'p1', paymentNumber: 'PAY-001', amount: '100', createdAt: new Date(), supplierName: 'Supplier A' },
        { id: 'p2', paymentNumber: 'PAY-002', amount: '200', createdAt: new Date(), supplierName: 'Supplier B' },
      ]) } as any;

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({ anomalies: [] }),
      });

      const result = await service.detectAnomalies({
        lookbackDays: 90,
        minConfidence: 0.5,
        context: baseContext,
      });

      expect(result.totalAnalysed).toBeGreaterThanOrEqual(0);
      expect(result.lookbackDays).toBe(90);
      expect(result.generatedAt).toBeDefined();
    });
  });

  // ─── gatherTransactionContext ───────────────────────────────────────────

  describe('gatherTransactionContext()', () => {
    it('scopes all queries by companyId', async () => {
      mockPrisma.payment = { findMany: vi.fn().mockResolvedValue([]) } as any;
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);

      await (service as any).gatherTransactionContext({
        companyId: 'company-xyz',
        lookbackDays: 90,
      });

      const paymentWhere = mockPrisma.payment.findMany.mock.calls[0]?.[0]?.where;
      expect(paymentWhere?.companyId).toBe('company-xyz');

      const invoiceWhere = mockPrisma.supplierInvoice.findMany.mock.calls[0]?.[0]?.where;
      expect(invoiceWhere?.companyId).toBe('company-xyz');
    });

    it('limits results to 500 records per model', async () => {
      mockPrisma.payment = { findMany: vi.fn().mockResolvedValue([]) } as any;
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);

      await (service as any).gatherTransactionContext({
        companyId: 'company-1',
        lookbackDays: 90,
      });

      const paymentArgs = mockPrisma.payment.findMany.mock.calls[0]?.[0];
      expect(paymentArgs?.take).toBe(500);

      const invoiceArgs = mockPrisma.supplierInvoice.findMany.mock.calls[0]?.[0];
      expect(invoiceArgs?.take).toBe(500);
    });

    it('degrades gracefully when models do not exist', async () => {
      // Simulate no payment or supplierInvoice models
      const prismaEmpty = {} as any;

      const serviceEmpty = new PredictionService(
        mockOrchestrator as any,
        prismaEmpty,
        mockLogger as any,
      );

      const result = await (serviceEmpty as any).gatherTransactionContext({
        companyId: 'company-1',
        lookbackDays: 90,
      });

      expect(result.payments).toEqual([]);
      expect(result.invoices).toEqual([]);
      expect(result.totalRecords).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('filters by entityTypes when provided', async () => {
      mockPrisma.payment = { findMany: vi.fn().mockResolvedValue([]) } as any;
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);

      await (service as any).gatherTransactionContext({
        companyId: 'company-1',
        lookbackDays: 90,
        entityTypes: ['Payment'],
      });

      // Payment should be queried
      expect(mockPrisma.payment.findMany).toHaveBeenCalled();
      // SupplierInvoice should NOT be queried
      expect(mockPrisma.supplierInvoice.findMany).not.toHaveBeenCalled();
    });

    it('calculates lookback date correctly', async () => {
      mockPrisma.payment = { findMany: vi.fn().mockResolvedValue([]) } as any;
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);

      const before = Date.now();
      await (service as any).gatherTransactionContext({
        companyId: 'company-1',
        lookbackDays: 30,
      });
      const after = Date.now();

      const paymentWhere = mockPrisma.payment.findMany.mock.calls[0]?.[0]?.where;
      const lookbackDate = paymentWhere?.createdAt?.gte as Date;

      // Lookback date should be approximately 30 days ago
      const expectedMin = new Date(before - 30 * 86_400_000);
      const expectedMax = new Date(after - 30 * 86_400_000);
      expect(lookbackDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(lookbackDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('returns totalRecords as sum of payments and invoices', async () => {
      mockPrisma.payment = { findMany: vi.fn().mockResolvedValue([
        { id: 'p1', paymentNumber: 'PAY-001', amount: '100', createdAt: new Date(), supplierName: 'S1' },
        { id: 'p2', paymentNumber: 'PAY-002', amount: '200', createdAt: new Date(), supplierName: 'S2' },
      ]) } as any;
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([
        { id: 'i1', invoiceNumber: 'INV-001', totalAmount: '300', createdAt: new Date(), supplierName: 'S1' },
      ]);

      const result = await (service as any).gatherTransactionContext({
        companyId: 'company-1',
        lookbackDays: 90,
      });

      expect(result.totalRecords).toBe(3);
      expect(result.payments).toHaveLength(2);
      expect(result.invoices).toHaveLength(1);
    });
  });

  // ─── detectDuplicates ───────────────────────────────────────────────────

  describe('detectDuplicates()', () => {
    it('calls orchestrator with intent "duplicate-detect" and routing tags ["standard"]', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({ duplicates: [] }),
      });

      await service.detectDuplicates({
        entityType: 'Customer',
        minSimilarity: 0.7,
        limit: 20,
        context: baseContext,
      });

      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.intent).toBe('duplicate-detect');
      expect(call.routingTags).toEqual(['standard']);

      expect(call.context).toEqual(baseContext);
    });

    it('filters pairs below minSimilarity', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Customer', entityId: 'c1', displayRef: 'Acme Ltd', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c2', displayRef: 'Acme Limited', data: {} },
              overallSimilarity: 0.92,
              fieldComparisons: [{ field: 'name', valueA: 'Acme Ltd', valueB: 'Acme Limited', similarity: 0.95 }],
            },
            {
              entityA: { entityType: 'Customer', entityId: 'c3', displayRef: 'Beta Corp', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c4', displayRef: 'Gamma Inc', data: {} },
              overallSimilarity: 0.3,
              fieldComparisons: [{ field: 'name', valueA: 'Beta Corp', valueB: 'Gamma Inc', similarity: 0.2 }],
            },
          ],
        }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Customer',
        minSimilarity: 0.7,
        limit: 20,
        context: baseContext,
      });

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]!.entityA.entityId).toBe('c1');
    });

    it('applies confidenceLevel to each pair', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Customer', entityId: 'c1', displayRef: 'A', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c2', displayRef: 'B', data: {} },
              overallSimilarity: 0.95,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Customer', entityId: 'c3', displayRef: 'C', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c4', displayRef: 'D', data: {} },
              overallSimilarity: 0.75,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Customer', entityId: 'c5', displayRef: 'E', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c6', displayRef: 'F', data: {} },
              overallSimilarity: 0.55,
              fieldComparisons: [],
            },
          ],
        }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Customer',
        minSimilarity: 0.5,
        limit: 20,
        context: baseContext,
      });

      expect(result.duplicates).toHaveLength(3);
      expect(result.duplicates[0]!.confidenceLevel).toBe('high');
      expect(result.duplicates[1]!.confidenceLevel).toBe('review');
      expect(result.duplicates[2]!.confidenceLevel).toBe('low');
    });

    it('respects limit parameter', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Supplier', entityId: 's1', displayRef: 'A', data: {} },
              entityB: { entityType: 'Supplier', entityId: 's2', displayRef: 'B', data: {} },
              overallSimilarity: 0.95,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Supplier', entityId: 's3', displayRef: 'C', data: {} },
              entityB: { entityType: 'Supplier', entityId: 's4', displayRef: 'D', data: {} },
              overallSimilarity: 0.85,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Supplier', entityId: 's5', displayRef: 'E', data: {} },
              entityB: { entityType: 'Supplier', entityId: 's6', displayRef: 'F', data: {} },
              overallSimilarity: 0.80,
              fieldComparisons: [],
            },
          ],
        }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Supplier',
        minSimilarity: 0.5,
        limit: 2,
        context: baseContext,
      });

      expect(result.duplicates).toHaveLength(2);
    });

    it('returns results sorted by similarity descending', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Contact', entityId: 'ct1', displayRef: 'Low', data: {} },
              entityB: { entityType: 'Contact', entityId: 'ct2', displayRef: 'Low2', data: {} },
              overallSimilarity: 0.6,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Contact', entityId: 'ct3', displayRef: 'High', data: {} },
              entityB: { entityType: 'Contact', entityId: 'ct4', displayRef: 'High2', data: {} },
              overallSimilarity: 0.95,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Contact', entityId: 'ct5', displayRef: 'Mid', data: {} },
              entityB: { entityType: 'Contact', entityId: 'ct6', displayRef: 'Mid2', data: {} },
              overallSimilarity: 0.8,
              fieldComparisons: [],
            },
          ],
        }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Contact',
        minSimilarity: 0.5,
        limit: 20,
        context: baseContext,
      });

      expect(result.duplicates[0]!.overallSimilarity).toBe(0.95);
      expect(result.duplicates[1]!.overallSimilarity).toBe(0.8);
      expect(result.duplicates[2]!.overallSimilarity).toBe(0.6);
    });

    it('handles malformed AI response gracefully', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'not valid json',
      });

      const result = await service.detectDuplicates({
        entityType: 'Customer',
        minSimilarity: 0.7,
        limit: 20,
        context: baseContext,
      });

      expect(result.duplicates).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to parse AI duplicate response as JSON — returning empty results',
      );
    });

    it('skips malformed duplicate pairs and logs warnings', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          duplicates: [
            { entityA: { entityId: 'c1' } }, // missing entityB and overallSimilarity
            {
              entityA: { entityType: 'Customer', entityId: 'c1', displayRef: 'Acme', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c2', displayRef: 'Acme Ltd', data: {} },
              overallSimilarity: 0.9,
              fieldComparisons: [{ field: 'name', valueA: 'Acme', valueB: 'Acme Ltd', similarity: 0.92 }],
            },
          ],
        }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Customer',
        minSimilarity: 0.5,
        limit: 20,
        context: baseContext,
      });

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]!.entityA.entityId).toBe('c1');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ raw: expect.any(Object) }),
        'Skipping malformed duplicate pair — missing required fields',
      );
    });

    it('returns totalScanned from entity count', async () => {
      // Set up customer model with data
      mockPrisma.customer = { findMany: vi.fn().mockResolvedValue([
        { id: 'c1', name: 'Acme Ltd', email: 'info@acme.com' },
        { id: 'c2', name: 'Acme Limited', email: 'info@acmelimited.com' },
        { id: 'c3', name: 'Beta Corp', email: 'beta@corp.com' },
      ]) } as any;

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({ duplicates: [] }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Customer',
        minSimilarity: 0.7,
        limit: 20,
        context: baseContext,
      });

      expect(result.totalScanned).toBe(3);
      expect(result.entityType).toBe('Customer');
      expect(result.generatedAt).toBeDefined();
    });

    it('includes field comparisons in results', async () => {
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Supplier', entityId: 's1', displayRef: 'Widget Co', data: { name: 'Widget Co' } },
              entityB: { entityType: 'Supplier', entityId: 's2', displayRef: 'Widget Company', data: { name: 'Widget Company' } },
              overallSimilarity: 0.88,
              fieldComparisons: [
                { field: 'name', valueA: 'Widget Co', valueB: 'Widget Company', similarity: 0.85 },
                { field: 'email', valueA: 'info@widget.co', valueB: 'info@widget.com', similarity: 0.9 },
                { field: 'vatNumber', valueA: 'GB123456789', valueB: 'GB123456789', similarity: 1.0 },
              ],
            },
          ],
        }),
      });

      const result = await service.detectDuplicates({
        entityType: 'Supplier',
        minSimilarity: 0.5,
        limit: 20,
        context: baseContext,
      });

      expect(result.duplicates[0]!.fieldComparisons).toHaveLength(3);
      expect(result.duplicates[0]!.fieldComparisons[2]!.field).toBe('vatNumber');
      expect(result.duplicates[0]!.fieldComparisons[2]!.similarity).toBe(1.0);
    });
  });

  // ─── loadEntitiesForDuplicateCheck ────────────────────────────────────────

  describe('loadEntitiesForDuplicateCheck()', () => {
    it('scopes queries by companyId', async () => {
      mockPrisma.customer = { findMany: vi.fn().mockResolvedValue([]) } as any;

      await (service as any).loadEntitiesForDuplicateCheck({
        entityType: 'Customer',
        companyId: 'company-abc',
      });

      const whereArg = mockPrisma.customer.findMany.mock.calls[0]?.[0]?.where;
      expect(whereArg?.companyId).toBe('company-abc');
      expect(whereArg?.isActive).toBe(true);
    });

    it('degrades gracefully when models do not exist', async () => {
      const prismaEmpty = {} as any;
      const serviceEmpty = new PredictionService(
        mockOrchestrator as any,
        prismaEmpty,
        mockLogger as any,
      );

      const result = await (serviceEmpty as any).loadEntitiesForDuplicateCheck({
        entityType: 'Customer',
        companyId: 'company-1',
      });

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('limits results to 1000 records', async () => {
      mockPrisma.supplier = { findMany: vi.fn().mockResolvedValue([]) } as any;

      await (service as any).loadEntitiesForDuplicateCheck({
        entityType: 'Supplier',
        companyId: 'company-1',
      });

      const queryArgs = mockPrisma.supplier.findMany.mock.calls[0]?.[0];
      expect(queryArgs?.take).toBe(1000);
    });

    it('maps entity fields correctly', async () => {
      mockPrisma.contact = { findMany: vi.fn().mockResolvedValue([
        {
          id: 'ct-1',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '+44 7700 900000',
          vatNumber: null,
          address1: '123 High St',
          address2: null,
          city: 'London',
          postCode: 'EC1A 1BB',
          country: 'GB',
          bankAccount: null,
        },
      ]) } as any;

      const result = await (service as any).loadEntitiesForDuplicateCheck({
        entityType: 'Contact',
        companyId: 'company-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('ct-1');
      expect(result[0]!.displayRef).toBe('John Smith');
      expect(result[0]!.data.email).toBe('john@example.com');
      expect(result[0]!.data.phone).toBe('+44 7700 900000');
      expect(result[0]!.data.address1).toBe('123 High St');
      expect(result[0]!.data.city).toBe('London');
      expect(result[0]!.data.postCode).toBe('EC1A 1BB');
      expect(result[0]!.data.vatNumber).toBeNull();
    });

    it('maps entity type to lowercase model name', async () => {
      mockPrisma.supplier = { findMany: vi.fn().mockResolvedValue([]) } as any;

      await (service as any).loadEntitiesForDuplicateCheck({
        entityType: 'Supplier',
        companyId: 'company-1',
      });

      expect(mockPrisma.supplier.findMany).toHaveBeenCalled();
    });
  });

  // ─── getConfidence ──────────────────────────────────────────────────────

  describe('getConfidence()', () => {
    it('returns confidence from AiMessage toolCalls', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          confidence: 0.92,
          toolCalls: [
            {
              name: 'create_invoice',
              input: {
                entityType: 'CustomerInvoice',
                entityId: 'inv-123',
                confidence: { amount: 0.95, dueDate: 0.88, customer: 0.91 },
              },
            },
          ],
          createdAt: new Date('2026-02-20T10:00:00Z'),
        },
      ]);

      const result = await service.getConfidence({
        entityType: 'CustomerInvoice',
        entityId: 'inv-123',
        context: baseContext,
      });

      expect(result).not.toBeNull();
      expect(result!.entityType).toBe('CustomerInvoice');
      expect(result!.entityId).toBe('inv-123');
      expect(result!.overallConfidence).toBe(0.92);
      expect(result!.confidenceLevel).toBe('high');
      expect(result!.fieldConfidence).toEqual({ amount: 0.95, dueDate: 0.88, customer: 0.91 });
      expect(result!.lastUpdated).toBe('2026-02-20T10:00:00.000Z');
    });

    it('returns null when entity has no AI-created record', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      const result = await service.getConfidence({
        entityType: 'CustomerInvoice',
        entityId: 'manual-entity-123',
        context: baseContext,
      });

      expect(result).toBeNull();
    });

    it('applies correct confidenceLevel', async () => {
      // Test with review-level confidence (0.75)
      mockPrisma.aiMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          confidence: 0.75,
          toolCalls: [{ input: { entityId: 'ent-1' } }],
          createdAt: new Date('2026-02-20T10:00:00Z'),
        },
      ]);

      const result = await service.getConfidence({
        entityType: 'Payment',
        entityId: 'ent-1',
        context: baseContext,
      });

      expect(result).not.toBeNull();
      expect(result!.confidenceLevel).toBe('review');
    });

    it('applies low confidenceLevel for scores below 0.7', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          confidence: 0.55,
          toolCalls: [{ input: { entityId: 'ent-2' } }],
          createdAt: new Date('2026-02-20T10:00:00Z'),
        },
      ]);

      const result = await service.getConfidence({
        entityType: 'Payment',
        entityId: 'ent-2',
        context: baseContext,
      });

      expect(result).not.toBeNull();
      expect(result!.confidenceLevel).toBe('low');
    });

    it('computes overall confidence from field confidences when message confidence is null', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          confidence: null,
          toolCalls: [
            {
              input: {
                entityId: 'ent-3',
                confidence: { name: 0.9, address: 0.8 },
              },
            },
          ],
          createdAt: new Date('2026-02-20T10:00:00Z'),
        },
      ]);

      const result = await service.getConfidence({
        entityType: 'Customer',
        entityId: 'ent-3',
        context: baseContext,
      });

      expect(result).not.toBeNull();
      // Average of 0.9 and 0.8 = 0.85
      expect(result!.overallConfidence).toBeCloseTo(0.85, 10);
      expect(result!.confidenceLevel).toBe('review');
    });

    it('scopes query by companyId via conversation relation', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      await service.getConfidence({
        entityType: 'CustomerInvoice',
        entityId: 'inv-999',
        context: { ...baseContext, companyId: 'company-xyz' },
      });

      const call = mockPrisma.aiMessage.findMany.mock.calls[0]![0];
      expect(call.where.conversation.companyId).toBe('company-xyz');
    });

    it('returns null on database error (graceful degradation)', async () => {
      mockPrisma.aiMessage.findMany.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.getConfidence({
        entityType: 'CustomerInvoice',
        entityId: 'inv-123',
        context: baseContext,
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ─── explain ────────────────────────────────────────────────────────────

  describe('explain()', () => {
    it('calls orchestrator with intent "explain" and routing tags ["standard"]', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          summary: 'This invoice was created based on the purchase order.',
          reasoning: ['Matched PO number', 'Extracted line items'],
          dataPoints: [],
        }),
      });

      await service.explain({
        entityType: 'CustomerInvoice',
        entityId: 'inv-123',
        decisionType: 'creation',
        context: baseContext,
      });

      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.intent).toBe('explain');
      expect(call.routingTags).toEqual(['standard']);

      expect(call.context).toEqual(baseContext);
    });

    it('includes entity data and original AI context in user message', async () => {
      // Set up entity model data
      mockPrisma.customerInvoice = { findMany: vi.fn().mockResolvedValue([
        { id: 'inv-123', invoiceNumber: 'INV-001', totalAmount: '5000.0000', companyId: 'company-1' },
      ]) } as any;

      // Set up original AI message
      mockPrisma.aiMessage.findMany.mockResolvedValue([{
        content: 'Created invoice from PO',
        toolCalls: [{ name: 'create_invoice', input: { entityId: 'inv-123' } }],
        confidence: 0.88,
        createdAt: new Date('2026-02-20T10:00:00Z'),
      }]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          summary: 'Invoice created from purchase order.',
          reasoning: ['Step 1'],
          dataPoints: [{ field: 'amount', value: '5000.0000', confidence: 0.95, source: 'extracted' }],
        }),
      });

      await service.explain({
        entityType: 'CustomerInvoice',
        entityId: 'inv-123',
        decisionType: 'creation',
        context: baseContext,
      });

      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.userMessage).toContain('creation');
      expect(call.userMessage).toContain('CustomerInvoice');
      expect(call.userMessage).toContain('inv-123');
    });

    it('returns structured ExplainResponse', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          summary: 'This anomaly was flagged due to duplicate payment amounts.',
          reasoning: [
            'Two payments of identical amounts to the same supplier within 7 days',
            'Historical average for this supplier is much lower',
          ],
          dataPoints: [
            { field: 'amount', value: '5000.0000', confidence: 0.95, source: 'extracted' },
            { field: 'supplier', value: 'Acme Ltd', confidence: 0.88, source: 'historical' },
          ],
        }),
      });

      const result = await service.explain({
        entityType: 'Payment',
        entityId: 'pay-123',
        decisionType: 'anomaly',
        context: baseContext,
      });

      expect(result.summary).toBe('This anomaly was flagged due to duplicate payment amounts.');
      expect(result.reasoning).toHaveLength(2);
      expect(result.reasoning[0]).toContain('Two payments');
      expect(result.dataPoints).toHaveLength(2);
      expect(result.dataPoints[0]!.field).toBe('amount');
      expect(result.dataPoints[0]!.confidence).toBe(0.95);
      expect(result.dataPoints[0]!.source).toBe('extracted');
    });

    it('handles malformed AI response gracefully', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: 'not valid json at all',
      });

      const result = await service.explain({
        entityType: 'Payment',
        entityId: 'pay-123',
        decisionType: 'anomaly',
        context: baseContext,
      });

      expect(result.summary).toContain('Unable to generate explanation');
      expect(result.reasoning).toEqual([]);
      expect(result.dataPoints).toEqual([]);
    });

    it('degrades gracefully when entity model does not exist', async () => {
      // No entity model available — will use empty context
      const prismaNoModels = {
        aiMessage: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      } as any;
      const serviceNoModels = new PredictionService(
        mockOrchestrator as any,
        prismaNoModels,
        mockLogger as any,
      );

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          summary: 'Limited explanation — entity data not available.',
          reasoning: ['Entity model not yet available'],
          dataPoints: [],
        }),
      });

      const result = await serviceNoModels.explain({
        entityType: 'CustomerInvoice',
        entityId: 'inv-123',
        decisionType: 'creation',
        context: baseContext,
      });

      expect(result.summary).toBeDefined();
      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
    });

    it('filters invalid data points in response', async () => {
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-1',
        content: JSON.stringify({
          summary: 'Explanation with mixed data points.',
          reasoning: ['Valid reasoning', 123, null], // mixed types — only strings kept
          dataPoints: [
            { field: 'amount', value: '100', confidence: 0.9, source: 'extracted' },
            null, // invalid — skipped
            { notAField: true }, // missing required 'field' — skipped
            { field: 'name', value: 'Test' }, // missing confidence/source — defaults applied
          ],
        }),
      });

      const result = await service.explain({
        entityType: 'Payment',
        entityId: 'pay-123',
        decisionType: 'creation',
        context: baseContext,
      });

      // Only valid strings kept in reasoning
      expect(result.reasoning).toEqual(['Valid reasoning']);
      // First data point valid, second skipped (null), third skipped (no field), fourth has defaults
      expect(result.dataPoints).toHaveLength(2);
      expect(result.dataPoints[0]!.field).toBe('amount');
      expect(result.dataPoints[1]!.field).toBe('name');
      expect(result.dataPoints[1]!.confidence).toBe(0);
      expect(result.dataPoints[1]!.source).toBe('unknown');
    });
  });
});

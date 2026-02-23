import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockOrchestrator, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    bankAccount: { findMany: vi.fn() },
    customerInvoice: { findMany: vi.fn() },
    supplierInvoice: { findMany: vi.fn() },
    purchaseOrder: { findMany: vi.fn() },
    recurringPayment: { findMany: vi.fn() },
    aiMessage: { findMany: vi.fn(), findFirst: vi.fn() },
  },
  mockResolveUserRole: vi.fn(),
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
    hasPermission: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
    getFieldVisibility: vi.fn(),
  },
  mockOrchestrator: {
    process: vi.fn(),
    processDirect: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../core/middleware/company-context.js';
import { registerErrorHandler } from '../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../core/validation/index.js';
import { predictionRoutesPlugin } from './prediction.routes.js';
import { PredictionService } from './prediction.service.js';
import { AiQuotaError } from './ai.errors.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_COMPANY_ID,
} from '../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Helpers — build a real PredictionService wired into Fastify
// ---------------------------------------------------------------------------

async function buildIntegrationApp(opts: { withService?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  if (opts.withService !== false) {
    // Wire real PredictionService with mocked orchestrator and Prisma
    const predictionService = new PredictionService(
      mockOrchestrator as any,
      mockPrisma as any,
      mockLogger as any,
    );
    app.decorate('aiPredictionService', predictionService as any);
  } else {
    app.decorate('aiPredictionService', null);
  }

  await app.register(predictionRoutesPlugin, { prefix: '/ai' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string; hasPermission?: boolean } = {}) {
  const resolvedRole = config.role ?? 'MANAGER';
  const hasPermission = config.hasPermission ?? true;

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const aiPredPerm = { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false };

  if (resolvedRole === 'SUPER_ADMIN') {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'ai.predictions': aiPredPerm },
      fieldOverrides: {},
      accessGroups: [],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else if (hasPermission) {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'ai.predictions': aiPredPerm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system'],
    });
  } else {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: [],
    });
  }

  // Default: all financial models return empty (graceful degradation)
  mockPrisma.bankAccount.findMany.mockResolvedValue([]);
  mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
  mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
  mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
  mockPrisma.recurringPayment.findMany.mockResolvedValue([]);
  mockPrisma.aiMessage.findMany.mockResolvedValue([]);
  mockPrisma.aiMessage.findFirst.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt({ role: 'MANAGER' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Integration Tests: Full prediction flow with real PredictionService
// ===========================================================================

describe('Prediction Integration Tests', () => {
  // ─── Cash Flow Forecast ─────────────────────────────────────────────────

  describe('POST /ai/predict/cash-flow — full flow', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns parsed periods and alerts from orchestrator JSON response', async () => {
      setupMocks({ role: 'MANAGER' });

      // Mock orchestrator to return structured forecast JSON
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-forecast-1',
        content: JSON.stringify({
          periods: [
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '50000.0000',
              inflows: '12000.0000',
              outflows: '8000.0000',
              netFlow: '4000.0000',
              closingBalance: '54000.0000',
              inflowDetails: [{ source: 'AR outstanding', amount: '12000.0000', description: 'Customer payments' }],
              outflowDetails: [{ source: 'AP outstanding', amount: '8000.0000', description: 'Supplier bills' }],
            },
            {
              periodStart: '2026-03-08',
              periodEnd: '2026-03-14',
              openingBalance: '54000.0000',
              inflows: '9000.0000',
              outflows: '7000.0000',
              netFlow: '2000.0000',
              closingBalance: '56000.0000',
              inflowDetails: [],
              outflowDetails: [],
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/predict/cash-flow',
        headers: authHeaders(testJwt),
        payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.periods).toHaveLength(2);
      expect(body.data.periods[0].periodStart).toBe('2026-03-01');
      expect(body.data.periods[0].closingBalance).toBe('54000.0000');
      expect(body.data.periods[0].inflowDetails).toHaveLength(1);
      expect(body.data.periods[0].inflowDetails[0].source).toBe('AR outstanding');
      expect(body.data.periods[1].closingBalance).toBe('56000.0000');
      expect(body.data.currency).toBe('GBP');
      expect(body.data.generatedAt).toBeDefined();
      // Orchestrator was called with correct intent
      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const call = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(call.intent).toBe('forecast');
      expect(call.routingTags).toEqual(['reasoning']);
      expect(call.systemPrompt).toBeDefined();
    });

    it('generates NEGATIVE_BALANCE alert when forecast has negative period', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-forecast-2',
        content: JSON.stringify({
          periods: [
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '5000.0000',
              inflows: '1000.0000',
              outflows: '8000.0000',
              netFlow: '-7000.0000',
              closingBalance: '-2000.0000',
              inflowDetails: [],
              outflowDetails: [],
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/predict/cash-flow',
        headers: authHeaders(testJwt),
        payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.alerts).toHaveLength(1);
      expect(body.data.alerts[0].type).toBe('NEGATIVE_BALANCE');
      expect(body.data.alerts[0].amount).toBe('-2000.0000');
      expect(body.data.alerts[0].suggestedAction).toBeDefined();
      expect(body.data.alerts[0].period).toContain('2026-03-01');
    });

    it('returns no alerts when all balances are positive and healthy', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-forecast-3',
        content: JSON.stringify({
          periods: [
            {
              periodStart: '2026-03-01',
              periodEnd: '2026-03-07',
              openingBalance: '50000.0000',
              inflows: '15000.0000',
              outflows: '10000.0000',
              netFlow: '5000.0000',
              closingBalance: '55000.0000',
              inflowDetails: [],
              outflowDetails: [],
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/predict/cash-flow',
        headers: authHeaders(testJwt),
        payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.alerts).toHaveLength(0);
      expect(body.data.periods).toHaveLength(1);
    });
  });

  // ─── Anomaly Detection ──────────────────────────────────────────────────

  describe('POST /ai/detect/anomalies — full flow', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns anomaly list with confidence levels applied', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-anomaly-1',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-001',
              displayRef: 'PAY-001',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'Duplicate payment of 5000.00 to Supplier A within 3 days',
              confidence: 0.95,
              relatedEntities: [
                { entityType: 'Payment', entityId: 'pay-002', displayRef: 'PAY-002', relationship: 'original_payment' },
              ],
              metadata: { duplicateAmount: '5000.0000' },
            },
            {
              entityType: 'SupplierInvoice',
              entityId: 'sinv-001',
              displayRef: 'SINV-001',
              anomalyType: 'UNUSUAL_AMOUNT',
              description: 'Invoice amount 50000.00 is 10x historical average for this supplier',
              confidence: 0.78,
              metadata: { historicalAverage: '5000.0000' },
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/anomalies',
        headers: authHeaders(testJwt),
        payload: { lookbackDays: 90, minConfidence: 0.5 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.anomalies).toHaveLength(2);

      // First anomaly — high confidence (>=0.9)
      expect(body.data.anomalies[0].anomalyType).toBe('DUPLICATE_AMOUNT');
      expect(body.data.anomalies[0].confidence).toBe(0.95);
      expect(body.data.anomalies[0].confidenceLevel).toBe('high');
      expect(body.data.anomalies[0].relatedEntities).toHaveLength(1);

      // Second anomaly — review confidence (>=0.7, <0.9)
      expect(body.data.anomalies[1].anomalyType).toBe('UNUSUAL_AMOUNT');
      expect(body.data.anomalies[1].confidence).toBe(0.78);
      expect(body.data.anomalies[1].confidenceLevel).toBe('review');

      // Sorted by confidence descending
      expect(body.data.anomalies[0].confidence).toBeGreaterThan(body.data.anomalies[1].confidence);
    });

    it('filters out anomalies below minConfidence threshold', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-anomaly-2',
        content: JSON.stringify({
          anomalies: [
            {
              entityType: 'Payment',
              entityId: 'pay-high',
              displayRef: 'PAY-HIGH',
              anomalyType: 'DUPLICATE_AMOUNT',
              description: 'High confidence anomaly',
              confidence: 0.92,
              metadata: {},
            },
            {
              entityType: 'Payment',
              entityId: 'pay-low',
              displayRef: 'PAY-LOW',
              anomalyType: 'ROUND_NUMBER_BIAS',
              description: 'Low confidence anomaly',
              confidence: 0.45,
              metadata: {},
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/anomalies',
        headers: authHeaders(testJwt),
        payload: { lookbackDays: 90, minConfidence: 0.7 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.anomalies).toHaveLength(1);
      expect(body.data.anomalies[0].entityId).toBe('pay-high');
    });
  });

  // ─── Duplicate Detection ────────────────────────────────────────────────

  describe('POST /ai/detect/duplicates — full flow', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns duplicate pairs with field comparisons for Customer entityType', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-dup-1',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Customer', entityId: 'c1', displayRef: 'Acme Ltd', data: { name: 'Acme Ltd', vatNumber: 'GB123456789' } },
              entityB: { entityType: 'Customer', entityId: 'c2', displayRef: 'ACME Limited', data: { name: 'ACME Limited', vatNumber: 'GB123456789' } },
              overallSimilarity: 0.92,
              fieldComparisons: [
                { field: 'name', valueA: 'Acme Ltd', valueB: 'ACME Limited', similarity: 0.85 },
                { field: 'vatNumber', valueA: 'GB123456789', valueB: 'GB123456789', similarity: 1.0 },
                { field: 'email', valueA: 'info@acme.co.uk', valueB: 'contact@acme.co.uk', similarity: 0.7 },
              ],
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/duplicates',
        headers: authHeaders(testJwt),
        payload: { entityType: 'Customer', minSimilarity: 0.7, limit: 20 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.entityType).toBe('Customer');
      expect(body.data.duplicates).toHaveLength(1);

      const pair = body.data.duplicates[0];
      expect(pair.entityA.displayRef).toBe('Acme Ltd');
      expect(pair.entityB.displayRef).toBe('ACME Limited');
      expect(pair.overallSimilarity).toBe(0.92);
      expect(pair.confidenceLevel).toBe('high');
      expect(pair.fieldComparisons).toHaveLength(3);
      expect(pair.fieldComparisons[1].field).toBe('vatNumber');
      expect(pair.fieldComparisons[1].similarity).toBe(1.0);
    });

    it('returns 400 for invalid entityType', async () => {
      setupMocks({ role: 'MANAGER' });
      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/duplicates',
        headers: authHeaders(testJwt),
        payload: { entityType: 'Invoice' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
    });
  });

  // ─── Confidence Scoring ─────────────────────────────────────────────────

  describe('GET /ai/confidence/:entityType/:entityId — full flow', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns confidence data extracted from AiMessage toolCalls', async () => {
      setupMocks({ role: 'MANAGER' });

      const entityId = randomUUID();
      mockPrisma.aiMessage.findMany.mockResolvedValue([
        {
          id: 'msg-conf-1',
          confidence: 0.91,
          toolCalls: [
            {
              name: 'create_invoice',
              input: {
                entityType: 'CustomerInvoice',
                entityId,
                confidence: { customerName: 0.95, amount: 0.90, dueDate: 0.88 },
              },
            },
          ],
          createdAt: new Date('2026-02-22T09:30:00Z'),
        },
      ]);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: `/ai/confidence/CustomerInvoice/${entityId}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.entityType).toBe('CustomerInvoice');
      expect(body.data.entityId).toBe(entityId);
      expect(body.data.overallConfidence).toBe(0.91);
      expect(body.data.confidenceLevel).toBe('high');
      expect(body.data.fieldConfidence.customerName).toBe(0.95);
      expect(body.data.fieldConfidence.amount).toBe(0.90);
      expect(body.data.fieldConfidence.dueDate).toBe(0.88);
      expect(body.data.lastUpdated).toBe('2026-02-22T09:30:00.000Z');
    });

    it('returns 404 when no AI record exists for entity (manual creation)', async () => {
      setupMocks({ role: 'MANAGER' });

      const entityId = randomUUID();
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: `/ai/confidence/CustomerInvoice/${entityId}`,
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Explainability ─────────────────────────────────────────────────────

  describe('POST /ai/explain — full flow', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns structured explanation from orchestrator', async () => {
      setupMocks({ role: 'MANAGER' });

      const entityId = randomUUID();

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-explain-1',
        content: JSON.stringify({
          summary: 'This invoice was created based on data extracted from the uploaded PDF.',
          reasoning: [
            'Customer name "Acme Ltd" matched existing record with 95% confidence',
            'Invoice amount £5,000.00 was extracted from the document total',
            'Due date was inferred from standard 30-day payment terms',
          ],
          dataPoints: [
            { field: 'customerName', value: 'Acme Ltd', confidence: 0.95, source: 'extracted' },
            { field: 'amount', value: '5000.0000', confidence: 0.90, source: 'extracted' },
            { field: 'dueDate', value: '2026-04-01', confidence: 0.75, source: 'inferred' },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/explain',
        headers: authHeaders(testJwt),
        payload: { entityType: 'CustomerInvoice', entityId, decisionType: 'creation' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.summary).toContain('uploaded PDF');
      expect(body.data.reasoning).toHaveLength(3);
      expect(body.data.reasoning[0]).toContain('Acme Ltd');
      expect(body.data.dataPoints).toHaveLength(3);
      expect(body.data.dataPoints[0].field).toBe('customerName');
      expect(body.data.dataPoints[0].confidence).toBe(0.95);
      expect(body.data.dataPoints[0].source).toBe('extracted');
      expect(body.data.dataPoints[2].source).toBe('inferred');
    });
  });

  // ─── Degradation (503) ──────────────────────────────────────────────────

  describe('All endpoints return 503 when AI service is degraded', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      setupMocks({ role: 'MANAGER' });
      app = await buildIntegrationApp({ withService: false });
    });

    afterEach(async () => { await app?.close(); });

    const degradedRoutes: Array<{ method: 'POST' | 'GET'; url: string; payload?: Record<string, unknown> }> = [
      { method: 'POST', url: '/ai/predict/cash-flow', payload: { startDate: '2026-03-01', endDate: '2026-03-31' } },
      { method: 'POST', url: '/ai/detect/anomalies', payload: {} },
      { method: 'POST', url: '/ai/detect/duplicates', payload: { entityType: 'Customer' } },
      { method: 'GET', url: `/ai/confidence/Invoice/${randomUUID()}` },
      { method: 'POST', url: '/ai/explain', payload: { entityType: 'Invoice', entityId: randomUUID(), decisionType: 'creation' } },
    ];

    for (const route of degradedRoutes) {
      it(`${route.method} ${route.url.replace(/\/[0-9a-f-]{36}/g, '/:id')} returns 503 with AI_DEGRADED`, async () => {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          headers: authHeaders(testJwt),
          ...(route.payload ? { payload: route.payload } : {}),
        });

        expect(res.statusCode).toBe(503);
        const body = res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('AI_DEGRADED');
        expect(body.error.messageKey).toBe('ai.error.degraded');
      });
    }
  });

  // ─── Authentication (401) ──────────────────────────────────────────────

  describe('All endpoints require authentication (401 without JWT)', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      app = await buildIntegrationApp();
    });

    afterEach(async () => { await app?.close(); });

    const unauthRoutes: Array<{ method: 'POST' | 'GET'; url: string; payload?: Record<string, unknown> }> = [
      { method: 'POST', url: '/ai/predict/cash-flow', payload: { startDate: '2026-03-01', endDate: '2026-03-31' } },
      { method: 'POST', url: '/ai/detect/anomalies', payload: {} },
      { method: 'POST', url: '/ai/detect/duplicates', payload: { entityType: 'Customer' } },
      { method: 'GET', url: `/ai/confidence/Invoice/${randomUUID()}` },
      { method: 'POST', url: '/ai/explain', payload: { entityType: 'Invoice', entityId: randomUUID(), decisionType: 'creation' } },
    ];

    for (const route of unauthRoutes) {
      it(`${route.method} ${route.url.replace(/\/[0-9a-f-]{36}/g, '/:id')} returns 401`, async () => {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          // No Authorization header
          ...(route.payload ? { payload: route.payload } : {}),
        });

        expect(res.statusCode).toBe(401);
      });
    }
  });

  // ─── Permission Guard (403) ────────────────────────────────────────────

  describe('All endpoints respect permission guard (403 without ai.predictions access)', () => {
    let app: FastifyInstance;
    let viewerJwt: string;

    beforeEach(async () => {
      setupMocks({ role: 'VIEWER', hasPermission: false });
      viewerJwt = await makeTestJwt({ role: 'VIEWER' });
      app = await buildIntegrationApp();
    });

    afterEach(async () => { await app?.close(); });

    const forbiddenRoutes: Array<{ method: 'POST' | 'GET'; url: string; payload?: Record<string, unknown> }> = [
      { method: 'POST', url: '/ai/predict/cash-flow', payload: { startDate: '2026-03-01', endDate: '2026-03-31' } },
      { method: 'POST', url: '/ai/detect/anomalies', payload: {} },
      { method: 'POST', url: '/ai/detect/duplicates', payload: { entityType: 'Customer' } },
      { method: 'GET', url: `/ai/confidence/Invoice/${randomUUID()}` },
      { method: 'POST', url: '/ai/explain', payload: { entityType: 'Invoice', entityId: randomUUID(), decisionType: 'creation' } },
    ];

    for (const route of forbiddenRoutes) {
      it(`${route.method} ${route.url.replace(/\/[0-9a-f-]{36}/g, '/:id')} returns 403`, async () => {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          headers: authHeaders(viewerJwt),
          ...(route.payload ? { payload: route.payload } : {}),
        });

        expect(res.statusCode).toBe(403);
        expect(res.json().success).toBe(false);
        expect(res.json().error.code).toBe('FORBIDDEN');
      });
    }
  });

  // ─── AI Gateway Quota Enforcement (429) ─────────────────────────────────

  describe('AI Gateway quota enforcement — AiQuotaError returns 429', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('POST /ai/predict/cash-flow returns 429 when orchestrator throws AiQuotaError', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockRejectedValue(
        new AiQuotaError('AI usage quota exceeded for tenant'),
      );

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/predict/cash-flow',
        headers: authHeaders(testJwt),
        payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AI_QUOTA_EXCEEDED');
    });

    it('POST /ai/detect/anomalies returns 429 when orchestrator throws AiQuotaError', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockRejectedValue(
        new AiQuotaError('AI usage quota exceeded for tenant'),
      );

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/anomalies',
        headers: authHeaders(testJwt),
        payload: { lookbackDays: 90, minConfidence: 0.5 },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AI_QUOTA_EXCEEDED');
    });

    it('POST /ai/detect/duplicates returns 429 when orchestrator throws AiQuotaError', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockRejectedValue(
        new AiQuotaError('AI usage quota exceeded for tenant'),
      );

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/duplicates',
        headers: authHeaders(testJwt),
        payload: { entityType: 'Customer' },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AI_QUOTA_EXCEEDED');
    });

    it('POST /ai/explain returns 429 when orchestrator throws AiQuotaError', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockRejectedValue(
        new AiQuotaError('AI usage quota exceeded for tenant'),
      );

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/explain',
        headers: authHeaders(testJwt),
        payload: { entityType: 'Payment', entityId: randomUUID(), decisionType: 'anomaly' },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AI_QUOTA_EXCEEDED');
    });
  });

  // ─── Graceful Degradation: Prisma models don't exist ────────────────────

  describe('Graceful degradation when business models do not exist', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('cash flow forecast works with empty financial context', async () => {
      setupMocks({ role: 'MANAGER' });

      // Build app with a Prisma that has no financial models
      const appNoModels = Fastify({ logger: false });
      appNoModels.setValidatorCompiler(zodValidatorCompiler);
      appNoModels.setSerializerCompiler(zodSerializerCompiler);
      registerErrorHandler(appNoModels);
      await appNoModels.register(jwtVerifyPlugin);
      await appNoModels.register(companyContextPlugin);

      const limitedPrisma = {
        user: mockPrisma.user,
        companyProfile: mockPrisma.companyProfile,
        aiMessage: mockPrisma.aiMessage,
        // No bankAccount, customerInvoice, etc.
      };

      const predictionService = new PredictionService(
        mockOrchestrator as any,
        limitedPrisma as any,
        mockLogger as any,
      );
      appNoModels.decorate('aiPredictionService', predictionService as any);
      await appNoModels.register(predictionRoutesPlugin, { prefix: '/ai' });
      await appNoModels.ready();
      app = appNoModels;

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-degrade-1',
        content: JSON.stringify({
          periods: [{
            periodStart: '2026-03-01',
            periodEnd: '2026-03-07',
            openingBalance: '0.0000',
            inflows: '0.0000',
            outflows: '0.0000',
            netFlow: '0.0000',
            closingBalance: '0.0000',
            inflowDetails: [],
            outflowDetails: [],
          }],
        }),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/ai/predict/cash-flow',
        headers: authHeaders(testJwt),
        payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.periods).toHaveLength(1);
      // Default balance when bank account model doesn't exist
      expect(body.data.currentBalance).toBe('0.0000');
      // Logger warns about missing models
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ─── Real getConfidenceLevel usage ──────────────────────────────────────

  describe('Confidence levels are applied using real getConfidenceLevel()', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('anomaly detection applies confidence thresholds: >=0.9 high, >=0.7 review, <0.7 low', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-conf-levels',
        content: JSON.stringify({
          anomalies: [
            { entityType: 'Payment', entityId: 'p1', anomalyType: 'DUPLICATE_AMOUNT', description: 'High', confidence: 0.95, metadata: {} },
            { entityType: 'Payment', entityId: 'p2', anomalyType: 'UNUSUAL_AMOUNT', description: 'Review', confidence: 0.75, metadata: {} },
            { entityType: 'Payment', entityId: 'p3', anomalyType: 'TIMING_ANOMALY', description: 'Low', confidence: 0.55, metadata: {} },
            { entityType: 'Payment', entityId: 'p4', anomalyType: 'ROUND_NUMBER_BIAS', description: 'Boundary high', confidence: 0.90, metadata: {} },
            { entityType: 'Payment', entityId: 'p5', anomalyType: 'SEQUENTIAL_INVOICES', description: 'Boundary review', confidence: 0.70, metadata: {} },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/anomalies',
        headers: authHeaders(testJwt),
        payload: { lookbackDays: 90, minConfidence: 0.5 },
      });

      expect(res.statusCode).toBe(200);
      const anomalies = res.json().data.anomalies;
      expect(anomalies).toHaveLength(5);

      // Find each by entityId (sorted by confidence desc)
      const high = anomalies.find((a: any) => a.entityId === 'p1');
      const review = anomalies.find((a: any) => a.entityId === 'p2');
      const low = anomalies.find((a: any) => a.entityId === 'p3');
      const boundaryHigh = anomalies.find((a: any) => a.entityId === 'p4');
      const boundaryReview = anomalies.find((a: any) => a.entityId === 'p5');

      expect(high.confidenceLevel).toBe('high');
      expect(review.confidenceLevel).toBe('review');
      expect(low.confidenceLevel).toBe('low');
      expect(boundaryHigh.confidenceLevel).toBe('high');    // exactly 0.90 → high
      expect(boundaryReview.confidenceLevel).toBe('review'); // exactly 0.70 → review
    });

    it('duplicate detection applies confidence levels to overallSimilarity', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-dup-conf',
        content: JSON.stringify({
          duplicates: [
            {
              entityA: { entityType: 'Customer', entityId: 'c1', displayRef: 'A', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c2', displayRef: 'B', data: {} },
              overallSimilarity: 0.92,
              fieldComparisons: [],
            },
            {
              entityA: { entityType: 'Customer', entityId: 'c3', displayRef: 'C', data: {} },
              entityB: { entityType: 'Customer', entityId: 'c4', displayRef: 'D', data: {} },
              overallSimilarity: 0.65,
              fieldComparisons: [],
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/detect/duplicates',
        headers: authHeaders(testJwt),
        payload: { entityType: 'Customer', minSimilarity: 0.5, limit: 20 },
      });

      expect(res.statusCode).toBe(200);
      const dups = res.json().data.duplicates;
      expect(dups[0].confidenceLevel).toBe('high');  // 0.92 >= 0.9
      expect(dups[1].confidenceLevel).toBe('low');   // 0.65 < 0.7
    });
  });

  // ─── Monetary values as strings ─────────────────────────────────────────

  describe('Monetary values are strings (Decimal(19,4) serialisation)', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('forecast periods return all monetary values as strings', async () => {
      setupMocks({ role: 'MANAGER' });

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-decimal-1',
        content: JSON.stringify({
          periods: [{
            periodStart: '2026-03-01',
            periodEnd: '2026-03-07',
            openingBalance: '12345.6789',
            inflows: '5000.5000',
            outflows: '3000.2500',
            netFlow: '2000.2500',
            closingBalance: '14345.9289',
            inflowDetails: [{ source: 'AR', amount: '5000.5000', description: 'Receivables' }],
            outflowDetails: [{ source: 'AP', amount: '3000.2500', description: 'Payables' }],
          }],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/predict/cash-flow',
        headers: authHeaders(testJwt),
        payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
      });

      expect(res.statusCode).toBe(200);
      const period = res.json().data.periods[0];

      // All monetary fields must be strings, not numbers
      expect(typeof period.openingBalance).toBe('string');
      expect(typeof period.inflows).toBe('string');
      expect(typeof period.outflows).toBe('string');
      expect(typeof period.netFlow).toBe('string');
      expect(typeof period.closingBalance).toBe('string');
      expect(typeof period.inflowDetails[0].amount).toBe('string');
      expect(typeof period.outflowDetails[0].amount).toBe('string');
      expect(typeof res.json().data.currentBalance).toBe('string');
    });
  });
});

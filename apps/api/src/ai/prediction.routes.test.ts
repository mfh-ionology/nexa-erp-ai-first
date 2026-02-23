import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
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
// Mock PredictionService
// ---------------------------------------------------------------------------

const mockPredictionService = vi.hoisted(() => ({
  forecastCashFlow: vi.fn(),
  detectAnomalies: vi.fn(),
  detectDuplicates: vi.fn(),
  getConfidence: vi.fn(),
  explain: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../core/middleware/company-context.js';
import { registerErrorHandler } from '../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../core/validation/index.js';
import { predictionRoutesPlugin } from './prediction.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(opts: { withPredictionService?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate with aiPredictionService (mimicking the AI plugin)
  const service = opts.withPredictionService !== false ? mockPredictionService : null;
  app.decorate('aiPredictionService', service as any);

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
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeForecastResponse() {
  return {
    generatedAt: '2026-02-22T10:00:00.000Z',
    currency: 'GBP',
    currentBalance: '50000.0000',
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
    ],
    alerts: [],
  };
}

function makeAnomalyResponse() {
  return {
    generatedAt: '2026-02-22T10:00:00.000Z',
    lookbackDays: 90,
    totalAnalysed: 42,
    anomalies: [
      {
        id: randomUUID(),
        entityType: 'Payment',
        entityId: randomUUID(),
        displayRef: 'PAY-001',
        anomalyType: 'DUPLICATE_AMOUNT',
        description: 'Duplicate payment of 5000.00 to Supplier A',
        confidence: 0.92,
        confidenceLevel: 'high',
        metadata: { originalPaymentId: randomUUID() },
      },
    ],
  };
}

function makeDuplicateResponse() {
  return {
    generatedAt: '2026-02-22T10:00:00.000Z',
    entityType: 'Customer',
    totalScanned: 100,
    duplicates: [
      {
        entityA: { entityType: 'Customer', entityId: randomUUID(), displayRef: 'Acme Ltd', data: { name: 'Acme Ltd' } },
        entityB: { entityType: 'Customer', entityId: randomUUID(), displayRef: 'ACME Limited', data: { name: 'ACME Limited' } },
        overallSimilarity: 0.88,
        confidenceLevel: 'review',
        fieldComparisons: [
          { field: 'name', valueA: 'Acme Ltd', valueB: 'ACME Limited', similarity: 0.85 },
        ],
      },
    ],
  };
}

function makeConfidenceResponse() {
  return {
    entityType: 'CustomerInvoice',
    entityId: randomUUID(),
    overallConfidence: 0.92,
    confidenceLevel: 'high',
    fieldConfidence: { customerName: 0.95, amount: 0.90, dueDate: 0.88 },
    lastUpdated: '2026-02-22T09:30:00.000Z',
  };
}

function makeExplainResponse() {
  return {
    summary: 'The invoice was created with high confidence based on extracted data.',
    reasoning: [
      'Customer name matched existing record with 95% confidence',
      'Amount was extracted from the document with 90% confidence',
    ],
    dataPoints: [
      { field: 'customerName', value: 'Acme Ltd', confidence: 0.95, source: 'extracted' },
      { field: 'amount', value: '1500.0000', confidence: 0.90, source: 'extracted' },
    ],
  };
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

// ---------------------------------------------------------------------------
// POST /ai/predict/cash-flow
// ---------------------------------------------------------------------------

describe('POST /ai/predict/cash-flow', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with forecast for valid request', async () => {
    setupMocks({ role: 'MANAGER' });
    const forecast = makeForecastResponse();
    mockPredictionService.forecastCashFlow.mockResolvedValue(forecast);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      headers: authHeaders(testJwt),
      payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.currency).toBe('GBP');
    expect(body.data.periods).toHaveLength(1);
    expect(body.data.periods[0].closingBalance).toBe('54000.0000');
  });

  it('passes correct context to service', async () => {
    setupMocks({ role: 'MANAGER' });
    mockPredictionService.forecastCashFlow.mockResolvedValue(makeForecastResponse());
    app = await buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      headers: { ...authHeaders(testJwt), 'accept-language': 'cy-GB,en-GB' },
      payload: {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: false,
        includeRecurring: false,
      },
    });

    expect(mockPredictionService.forecastCashFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeCommittedPOs: false,
        includeRecurring: false,
        context: expect.objectContaining({
          userId: TEST_USER_ID,
          companyId: TEST_COMPANY_ID,
          tenantId: TEST_COMPANY_ID,
          locale: 'cy-GB',
        }),
      }),
    );
  });

  it('returns 403 without ai.predictions permission', async () => {
    setupMocks({ role: 'VIEWER', hasPermission: false });
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      headers: authHeaders(viewerJwt),
      payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 400 with invalid date format', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      headers: authHeaders(testJwt),
      payload: { startDate: 'not-a-date', endDate: '2026-03-31' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 400 when startDate is after endDate', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      headers: authHeaders(testJwt),
      payload: { startDate: '2026-04-01', endDate: '2026-03-01' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 503 when prediction service is null (AI degraded)', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withPredictionService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      headers: authHeaders(testJwt),
      payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_DEGRADED');
    expect(body.error.messageKey).toBe('ai.error.degraded');
  });

  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/predict/cash-flow',
      payload: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /ai/detect/anomalies
// ---------------------------------------------------------------------------

describe('POST /ai/detect/anomalies', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with anomaly results for valid request', async () => {
    setupMocks({ role: 'MANAGER' });
    const anomalies = makeAnomalyResponse();
    mockPredictionService.detectAnomalies.mockResolvedValue(anomalies);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/detect/anomalies',
      headers: authHeaders(testJwt),
      payload: { lookbackDays: 90, minConfidence: 0.5 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.anomalies).toHaveLength(1);
    expect(body.data.anomalies[0].anomalyType).toBe('DUPLICATE_AMOUNT');
    expect(body.data.anomalies[0].confidence).toBe(0.92);
    expect(body.data.anomalies[0].confidenceLevel).toBe('high');
    expect(body.data.totalAnalysed).toBe(42);
  });

  it('uses default values for optional body fields', async () => {
    setupMocks({ role: 'MANAGER' });
    mockPredictionService.detectAnomalies.mockResolvedValue(makeAnomalyResponse());
    app = await buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/ai/detect/anomalies',
      headers: authHeaders(testJwt),
      payload: {},
    });

    expect(mockPredictionService.detectAnomalies).toHaveBeenCalledWith(
      expect.objectContaining({
        lookbackDays: 90,
        minConfidence: 0.5,
      }),
    );
  });

  it('returns 400 with lookbackDays out of range', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/detect/anomalies',
      headers: authHeaders(testJwt),
      payload: { lookbackDays: 3 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 503 when prediction service is null', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withPredictionService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/detect/anomalies',
      headers: authHeaders(testJwt),
      payload: {},
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('AI_DEGRADED');
  });
});

// ---------------------------------------------------------------------------
// POST /ai/detect/duplicates
// ---------------------------------------------------------------------------

describe('POST /ai/detect/duplicates', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with duplicate pairs for valid entityType', async () => {
    setupMocks({ role: 'MANAGER' });
    const duplicates = makeDuplicateResponse();
    mockPredictionService.detectDuplicates.mockResolvedValue(duplicates);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/detect/duplicates',
      headers: authHeaders(testJwt),
      payload: { entityType: 'Customer' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.entityType).toBe('Customer');
    expect(body.data.duplicates).toHaveLength(1);
    expect(body.data.duplicates[0].overallSimilarity).toBe(0.88);
    expect(body.data.duplicates[0].fieldComparisons).toHaveLength(1);
  });

  it('returns 400 with invalid entityType', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/detect/duplicates',
      headers: authHeaders(testJwt),
      payload: { entityType: 'Invoice' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('passes limit and minSimilarity to service', async () => {
    setupMocks({ role: 'MANAGER' });
    mockPredictionService.detectDuplicates.mockResolvedValue(makeDuplicateResponse());
    app = await buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/ai/detect/duplicates',
      headers: authHeaders(testJwt),
      payload: { entityType: 'Supplier', minSimilarity: 0.8, limit: 10 },
    });

    expect(mockPredictionService.detectDuplicates).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Supplier',
        minSimilarity: 0.8,
        limit: 10,
      }),
    );
  });

  it('returns 503 when prediction service is null', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withPredictionService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/detect/duplicates',
      headers: authHeaders(testJwt),
      payload: { entityType: 'Customer' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('AI_DEGRADED');
  });
});

// ---------------------------------------------------------------------------
// GET /ai/confidence/:entityType/:entityId
// ---------------------------------------------------------------------------

describe('GET /ai/confidence/:entityType/:entityId', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with confidence data for AI-created entity', async () => {
    setupMocks({ role: 'MANAGER' });
    const confidence = makeConfidenceResponse();
    mockPredictionService.getConfidence.mockResolvedValue(confidence);
    app = await buildTestApp();

    const entityId = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/ai/confidence/CustomerInvoice/${entityId}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.overallConfidence).toBe(0.92);
    expect(body.data.confidenceLevel).toBe('high');
    expect(body.data.fieldConfidence.customerName).toBe(0.95);
  });

  it('returns 404 when no AI record exists for entity', async () => {
    setupMocks({ role: 'MANAGER' });
    mockPredictionService.getConfidence.mockResolvedValue(null);
    app = await buildTestApp();

    const entityId = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/ai/confidence/CustomerInvoice/${entityId}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.messageKey).toBe('ai.error.confidenceNotFound');
  });

  it('returns 400 with invalid entityId (not UUID)', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/confidence/CustomerInvoice/not-a-uuid',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 503 when prediction service is null', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withPredictionService: false });

    const entityId = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/ai/confidence/CustomerInvoice/${entityId}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('AI_DEGRADED');
  });
});

// ---------------------------------------------------------------------------
// POST /ai/explain
// ---------------------------------------------------------------------------

describe('POST /ai/explain', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with explanation for valid request', async () => {
    setupMocks({ role: 'MANAGER' });
    const explanation = makeExplainResponse();
    mockPredictionService.explain.mockResolvedValue(explanation);
    app = await buildTestApp();

    const entityId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/ai/explain',
      headers: authHeaders(testJwt),
      payload: { entityType: 'CustomerInvoice', entityId, decisionType: 'creation' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.summary).toContain('high confidence');
    expect(body.data.reasoning).toHaveLength(2);
    expect(body.data.dataPoints).toHaveLength(2);
    expect(body.data.dataPoints[0].source).toBe('extracted');
  });

  it('returns 400 with invalid decisionType', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/explain',
      headers: authHeaders(testJwt),
      payload: { entityType: 'CustomerInvoice', entityId: randomUUID(), decisionType: 'invalid' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 400 with invalid entityId (not UUID)', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/explain',
      headers: authHeaders(testJwt),
      payload: { entityType: 'CustomerInvoice', entityId: 'not-a-uuid', decisionType: 'creation' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 503 when prediction service is null', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withPredictionService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/explain',
      headers: authHeaders(testJwt),
      payload: { entityType: 'CustomerInvoice', entityId: randomUUID(), decisionType: 'anomaly' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('AI_DEGRADED');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: All routes return 503 when predictionService is null
// ---------------------------------------------------------------------------

describe('All prediction routes return 503 when AI degraded', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withPredictionService: false });
  });

  afterEach(async () => { await app?.close(); });

  const routes: Array<{ method: 'POST' | 'GET'; url: string; payload?: Record<string, unknown> }> = [
    { method: 'POST', url: '/ai/predict/cash-flow', payload: { startDate: '2026-03-01', endDate: '2026-03-31' } },
    { method: 'POST', url: '/ai/detect/anomalies', payload: {} },
    { method: 'POST', url: '/ai/detect/duplicates', payload: { entityType: 'Customer' } },
    { method: 'GET', url: `/ai/confidence/Invoice/${randomUUID()}` },
    { method: 'POST', url: '/ai/explain', payload: { entityType: 'Invoice', entityId: randomUUID(), decisionType: 'creation' } },
  ];

  for (const route of routes) {
    it(`${route.method} ${route.url} returns 503`, async () => {
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
    });
  }
});

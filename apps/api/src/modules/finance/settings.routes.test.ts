import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    systemSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
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
  SettingCategory: {
    GENERAL: 'GENERAL',
    FINANCE: 'FINANCE',
    AR: 'AR',
    AP: 'AP',
    SALES: 'SALES',
    PURCHASING: 'PURCHASING',
    INVENTORY: 'INVENTORY',
    CRM: 'CRM',
    HR: 'HR',
    MANUFACTURING: 'MANUFACTURING',
    REPORTING: 'REPORTING',
  },
  SettingValueType: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    JSON: 'JSON',
  },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { settingsRoutesPlugin } from './settings.routes.js';
import { FINANCE_DEFAULTS } from './settings.service.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTestJwt(overrides: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({
    tenantId: TEST_TENANT_ID,
    role: 'ADMIN',
    enabledModules: ['FINANCE'],
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(TEST_USER_ID)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secretBytes);
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  registerErrorHandler(app);

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(settingsRoutesPlugin, { prefix: '/finance' });

  await app.ready();
  return app;
}

function setupMocks() {
  // Middleware queries user for isActive + default companyId
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });

  mockResolveUserRole.mockResolvedValue('ADMIN');

  // Configure permission service: full access for ADMIN
  mockPermissionService.getEffectivePermissions.mockImplementation(
    async (_prisma: unknown, _userId: string, _companyId: string, userRole: string) => {
      const hasAccess = ['ADMIN', 'MANAGER'].includes(userRole);
      const fullPerm = {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      };
      return {
        permissions: hasAccess ? { 'finance.settings': fullPerm } : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;
let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

afterEach(async () => {
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// GET /finance/settings — AC-1
// ---------------------------------------------------------------------------

describe('GET /finance/settings', () => {
  it('returns defaults when no settings exist', async () => {
    app = await buildTestApp();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/settings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // Verify all 12 tabs are present
    expect(body.data.general).toBeDefined();
    expect(body.data.vat).toBeDefined();
    expect(body.data.subSystems).toBeDefined();
    expect(body.data.tags).toBeDefined();
    expect(body.data.dimensions).toBeDefined();
    expect(body.data.dataEntry).toBeDefined();
    expect(body.data.approvals).toBeDefined();
    expect(body.data.reconciliation).toBeDefined();
    expect(body.data.multiCurrency).toBeDefined();
    expect(body.data.numberSeries).toBeDefined();
    expect(body.data.rounding).toBeDefined();
    expect(body.data.reporting).toBeDefined();

    // Verify default values
    expect(body.data.general.fiscalYearStartMonth).toBe(1);
    expect(body.data.general.baseCurrency).toBe('GBP');
    expect(body.data.general.defaultPaymentTerms).toBe(30);
    expect(body.data.vat.vatScheme).toBe('STANDARD');
    expect(body.data.vat.mtdEnabled).toBe(false);
    expect(body.data.subSystems.arEnabled).toBe(true);
    expect(body.data.reconciliation.autoMatchThreshold).toBe(95);
    expect(body.data.reporting.defaultReportFormat).toBe('PDF');
  });

  it('merges stored settings with defaults', async () => {
    app = await buildTestApp();
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'general.baseCurrency', value: 'USD', valueType: 'STRING' },
      { key: 'vat.mtdEnabled', value: 'true', valueType: 'BOOLEAN' },
      { key: 'reconciliation.autoMatchThreshold', value: '80', valueType: 'NUMBER' },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/settings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Overridden values
    expect(body.data.general.baseCurrency).toBe('USD');
    expect(body.data.vat.mtdEnabled).toBe(true);
    expect(body.data.reconciliation.autoMatchThreshold).toBe(80);

    // Non-overridden values remain at defaults
    expect(body.data.general.fiscalYearStartMonth).toBe(1);
    expect(body.data.vat.vatScheme).toBe('STANDARD');
  });

  it('calls Prisma with correct companyId and FINANCE category', async () => {
    app = await buildTestApp();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/settings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.systemSetting.findMany).toHaveBeenCalledWith({
      where: { companyId: TEST_COMPANY_ID, category: 'FINANCE' },
      select: { key: true, value: true, valueType: true },
    });
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/settings',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/settings — AC-2
// ---------------------------------------------------------------------------

describe('PUT /finance/settings', () => {
  it('updates specific tab settings', async () => {
    app = await buildTestApp();

    // Mock $transaction to execute all upserts
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    // After update, return the updated values
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'general.baseCurrency', value: 'EUR', valueType: 'STRING' },
      { key: 'general.defaultPaymentTerms', value: '45', valueType: 'NUMBER' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        general: {
          baseCurrency: 'EUR',
          defaultPaymentTerms: 45,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.general.baseCurrency).toBe('EUR');
    expect(body.data.general.defaultPaymentTerms).toBe(45);
  });

  it('updates multiple tabs at once', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'vat.vatScheme', value: 'FLAT_RATE', valueType: 'STRING' },
      { key: 'vat.flatRatePercentage', value: '16.5', valueType: 'NUMBER' },
      { key: 'multiCurrency.multiCurrencyEnabled', value: 'true', valueType: 'BOOLEAN' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        vat: {
          vatScheme: 'FLAT_RATE',
          flatRatePercentage: 16.5,
        },
        multiCurrency: {
          multiCurrencyEnabled: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.vat.vatScheme).toBe('FLAT_RATE');
    expect(body.data.vat.flatRatePercentage).toBe(16.5);
    expect(body.data.multiCurrency.multiCurrencyEnabled).toBe(true);
  });

  it('rejects invalid fiscalYearStartMonth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        general: {
          fiscalYearStartMonth: 13,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid vatScheme enum', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        vat: {
          vatScheme: 'INVALID_SCHEME',
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects autoMatchThreshold outside 0-100 range', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        reconciliation: {
          autoMatchThreshold: 150,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid defaultReportFormat', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        reporting: {
          defaultReportFormat: 'XML',
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accepts an empty body (no-op update)', async () => {
    app = await buildTestApp();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    // $transaction should not have been called for empty payload
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: { 'content-type': 'application/json' },
      payload: { general: { baseCurrency: 'EUR' } },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/settings — Dimensions tab
// ---------------------------------------------------------------------------

describe('PUT /finance/settings — dimensions tab', () => {
  it('saves and loads dimension settings', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'dimensions.enableDimensions', value: 'true', valueType: 'BOOLEAN' },
      {
        key: 'dimensions.requireDimensionsOnManualJournals',
        value: 'true',
        valueType: 'BOOLEAN',
      },
      { key: 'dimensions.defaultDimensionBehavior', value: 'SUGGEST', valueType: 'STRING' },
      { key: 'dimensions.maxDimensionTypes', value: '5', valueType: 'NUMBER' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensions: {
          enableDimensions: true,
          requireDimensionsOnManualJournals: true,
          defaultDimensionBehavior: 'SUGGEST',
          maxDimensionTypes: 5,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.dimensions.enableDimensions).toBe(true);
    expect(body.data.dimensions.requireDimensionsOnManualJournals).toBe(true);
    expect(body.data.dimensions.defaultDimensionBehavior).toBe('SUGGEST');
    expect(body.data.dimensions.maxDimensionTypes).toBe(5);
  });

  it('rejects invalid defaultDimensionBehavior enum', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensions: {
          defaultDimensionBehavior: 'INVALID',
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects maxDimensionTypes outside 1-20 range', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        dimensions: {
          maxDimensionTypes: 25,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/settings — Approvals tab
// ---------------------------------------------------------------------------

describe('PUT /finance/settings — approvals tab', () => {
  it('saves and loads approval settings', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'approvals.journalApprovalEnabled', value: 'true', valueType: 'BOOLEAN' },
      { key: 'approvals.journalApprovalThreshold', value: '50000', valueType: 'NUMBER' },
      { key: 'approvals.budgetApprovalRequired', value: 'false', valueType: 'BOOLEAN' },
      { key: 'approvals.yearEndApprovalRequired', value: 'true', valueType: 'BOOLEAN' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        approvals: {
          journalApprovalEnabled: true,
          journalApprovalThreshold: 50000,
          budgetApprovalRequired: false,
          yearEndApprovalRequired: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.approvals.journalApprovalEnabled).toBe(true);
    expect(body.data.approvals.journalApprovalThreshold).toBe(50000);
    expect(body.data.approvals.budgetApprovalRequired).toBe(false);
    expect(body.data.approvals.yearEndApprovalRequired).toBe(true);
  });

  it('rejects negative journalApprovalThreshold', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        approvals: {
          journalApprovalThreshold: -100,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/settings — Number Series tab
// ---------------------------------------------------------------------------

describe('PUT /finance/settings — numberSeries tab', () => {
  it('saves and loads number series settings', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'numberSeries.journalPrefix', value: 'GL', valueType: 'STRING' },
      { key: 'numberSeries.journalPadding', value: '6', valueType: 'NUMBER' },
      { key: 'numberSeries.simulationPrefix', value: 'WIF', valueType: 'STRING' },
      { key: 'numberSeries.simulationPadding', value: '4', valueType: 'NUMBER' },
      { key: 'numberSeries.budgetPrefix', value: 'BUD', valueType: 'STRING' },
      { key: 'numberSeries.budgetPadding', value: '7', valueType: 'NUMBER' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        numberSeries: {
          journalPrefix: 'GL',
          journalPadding: 6,
          simulationPrefix: 'WIF',
          simulationPadding: 4,
          budgetPrefix: 'BUD',
          budgetPadding: 7,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.numberSeries.journalPrefix).toBe('GL');
    expect(body.data.numberSeries.journalPadding).toBe(6);
    expect(body.data.numberSeries.simulationPrefix).toBe('WIF');
    expect(body.data.numberSeries.simulationPadding).toBe(4);
    expect(body.data.numberSeries.budgetPrefix).toBe('BUD');
    expect(body.data.numberSeries.budgetPadding).toBe(7);
  });

  it('rejects journalPadding outside 4-10 range', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        numberSeries: {
          journalPadding: 2,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects prefix exceeding max length', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        numberSeries: {
          journalPrefix: 'TOOLONGPREFIX',
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/settings — Rounding tab
// ---------------------------------------------------------------------------

describe('PUT /finance/settings — rounding tab', () => {
  it('saves and loads rounding settings', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'rounding.currencyRoundingMethod', value: 'HALF_EVEN', valueType: 'STRING' },
      { key: 'rounding.displayDecimals', value: '3', valueType: 'NUMBER' },
      { key: 'rounding.internalDecimals', value: '4', valueType: 'NUMBER' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        rounding: {
          currencyRoundingMethod: 'HALF_EVEN',
          displayDecimals: 3,
          internalDecimals: 4,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.rounding.currencyRoundingMethod).toBe('HALF_EVEN');
    expect(body.data.rounding.displayDecimals).toBe(3);
    expect(body.data.rounding.internalDecimals).toBe(4);
  });

  it('rejects invalid currencyRoundingMethod enum', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        rounding: {
          currencyRoundingMethod: 'ROUND_RANDOM',
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects displayDecimals outside 0-4 range', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        rounding: {
          displayDecimals: 5,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects internalDecimals below minimum of 2', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        rounding: {
          internalDecimals: 1,
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/settings — defaults for new tabs
// ---------------------------------------------------------------------------

describe('GET /finance/settings — new tab defaults', () => {
  it('returns correct defaults for all 4 new tabs when no settings exist', async () => {
    app = await buildTestApp();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/settings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Dimensions defaults
    expect(body.data.dimensions.enableDimensions).toBe(false);
    expect(body.data.dimensions.requireDimensionsOnManualJournals).toBe(false);
    expect(body.data.dimensions.defaultDimensionBehavior).toBe('NONE');
    expect(body.data.dimensions.maxDimensionTypes).toBe(10);

    // Approvals defaults
    expect(body.data.approvals.journalApprovalEnabled).toBe(false);
    expect(body.data.approvals.journalApprovalThreshold).toBe(10000);
    expect(body.data.approvals.budgetApprovalRequired).toBe(true);
    expect(body.data.approvals.yearEndApprovalRequired).toBe(true);

    // Number Series defaults
    expect(body.data.numberSeries.journalPrefix).toBe('JNL');
    expect(body.data.numberSeries.journalPadding).toBe(5);
    expect(body.data.numberSeries.simulationPrefix).toBe('SIM');
    expect(body.data.numberSeries.simulationPadding).toBe(5);
    expect(body.data.numberSeries.budgetPrefix).toBe('BDG');
    expect(body.data.numberSeries.budgetPadding).toBe(5);

    // Rounding defaults
    expect(body.data.rounding.currencyRoundingMethod).toBe('HALF_UP');
    expect(body.data.rounding.displayDecimals).toBe(2);
    expect(body.data.rounding.internalDecimals).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/settings/reset — AC-3
// ---------------------------------------------------------------------------

describe('POST /finance/settings/reset', () => {
  it('deletes all FINANCE settings and returns defaults', async () => {
    app = await buildTestApp();
    mockPrisma.systemSetting.deleteMany.mockResolvedValue({ count: 5 });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/settings/reset',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify deleteMany was called with correct filters
    expect(mockPrisma.systemSetting.deleteMany).toHaveBeenCalledWith({
      where: { companyId: TEST_COMPANY_ID, category: 'FINANCE' },
    });

    // Verify response contains all default values (original 8 tabs)
    expect(body.data.general.fiscalYearStartMonth).toBe(
      FINANCE_DEFAULTS.general.fiscalYearStartMonth,
    );
    expect(body.data.general.baseCurrency).toBe(FINANCE_DEFAULTS.general.baseCurrency);
    expect(body.data.vat.vatScheme).toBe(FINANCE_DEFAULTS.vat.vatScheme);
    expect(body.data.subSystems.arEnabled).toBe(FINANCE_DEFAULTS.subSystems.arEnabled);
    expect(body.data.tags.enableDepartments).toBe(FINANCE_DEFAULTS.tags.enableDepartments);
    expect(body.data.dataEntry.defaultSource).toBe(FINANCE_DEFAULTS.dataEntry.defaultSource);
    expect(body.data.reconciliation.autoMatchThreshold).toBe(
      FINANCE_DEFAULTS.reconciliation.autoMatchThreshold,
    );
    expect(body.data.multiCurrency.rateSource).toBe(FINANCE_DEFAULTS.multiCurrency.rateSource);
    expect(body.data.reporting.defaultReportFormat).toBe(
      FINANCE_DEFAULTS.reporting.defaultReportFormat,
    );

    // Verify response contains defaults for 4 new tabs
    expect(body.data.dimensions.enableDimensions).toBe(
      FINANCE_DEFAULTS.dimensions.enableDimensions,
    );
    expect(body.data.dimensions.maxDimensionTypes).toBe(
      FINANCE_DEFAULTS.dimensions.maxDimensionTypes,
    );
    expect(body.data.approvals.journalApprovalEnabled).toBe(
      FINANCE_DEFAULTS.approvals.journalApprovalEnabled,
    );
    expect(body.data.approvals.journalApprovalThreshold).toBe(
      FINANCE_DEFAULTS.approvals.journalApprovalThreshold,
    );
    expect(body.data.numberSeries.journalPrefix).toBe(FINANCE_DEFAULTS.numberSeries.journalPrefix);
    expect(body.data.numberSeries.budgetPadding).toBe(FINANCE_DEFAULTS.numberSeries.budgetPadding);
    expect(body.data.rounding.currencyRoundingMethod).toBe(
      FINANCE_DEFAULTS.rounding.currencyRoundingMethod,
    );
    expect(body.data.rounding.displayDecimals).toBe(FINANCE_DEFAULTS.rounding.displayDecimals);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/settings/reset',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER role on GET', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/finance/settings',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on PUT', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { general: { baseCurrency: 'EUR' } },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /settings/reset', async () => {
    app = await buildTestApp();
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });

    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: 'VIEWER',
      isSuperAdmin: false,
      enabledModules: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/settings/reset',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

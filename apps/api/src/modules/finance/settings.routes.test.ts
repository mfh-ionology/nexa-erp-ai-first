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

    // Verify all 8 tabs are present
    expect(body.data.general).toBeDefined();
    expect(body.data.vat).toBeDefined();
    expect(body.data.subSystems).toBeDefined();
    expect(body.data.tags).toBeDefined();
    expect(body.data.dataEntry).toBeDefined();
    expect(body.data.reconciliation).toBeDefined();
    expect(body.data.multiCurrency).toBeDefined();
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

    // Verify response contains all default values
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

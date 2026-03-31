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
    accountMapping: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    chartOfAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
import { accountMappingsRoutesPlugin } from './account-mappings.routes.js';
import { FRS102_DEFAULT_MAPPINGS } from './account-mappings.service.js';

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
  await app.register(accountMappingsRoutesPlugin, { prefix: '/finance' });

  await app.ready();
  return app;
}

function setupMocks() {
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    id: TEST_COMPANY_ID,
    isActive: true,
  });

  mockResolveUserRole.mockResolvedValue('ADMIN');

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
        permissions: hasAccess ? { 'finance.accountMappings': fullPerm } : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

/** Build a fake AccountMapping row with joined account for mock responses. */
function makeMappingRow(
  mappingType: string,
  accountCode: string,
  description: string,
  accountName = 'Test Account',
) {
  return {
    id: `mapping-${mappingType}`,
    companyId: TEST_COMPANY_ID,
    mappingType,
    accountCode,
    departmentCode: null,
    description,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    account: { name: accountName },
  };
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
// GET /finance/account-mappings — AC-1
// ---------------------------------------------------------------------------

describe('GET /finance/account-mappings', () => {
  it('returns all account mappings with account name', async () => {
    app = await buildTestApp();

    const mockRows = [
      makeMappingRow('AR_CONTROL', '1100', 'Accounts Receivable Control', 'Trade Debtors'),
      makeMappingRow('AP_CONTROL', '2100', 'Accounts Payable Control', 'Trade Creditors'),
    ];
    mockPrisma.accountMapping.findMany.mockResolvedValue(mockRows);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/account-mappings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].mappingType).toBe('AR_CONTROL');
    expect(body.data[0].accountCode).toBe('1100');
    expect(body.data[0].accountName).toBe('Trade Debtors');
    expect(body.data[0].departmentCode).toBeNull();
    expect(body.data[1].mappingType).toBe('AP_CONTROL');
  });

  it('returns empty array when no mappings exist', async () => {
    app = await buildTestApp();
    mockPrisma.accountMapping.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/account-mappings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('queries Prisma with correct companyId and includes account', async () => {
    app = await buildTestApp();
    mockPrisma.accountMapping.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/finance/account-mappings',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.accountMapping.findMany).toHaveBeenCalledWith({
      where: { companyId: TEST_COMPANY_ID },
      include: { account: { select: { name: true } } },
      orderBy: { mappingType: 'asc' },
    });
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/account-mappings',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /finance/account-mappings — AC-2
// ---------------------------------------------------------------------------

describe('PUT /finance/account-mappings', () => {
  it('batch updates mappings when accounts are valid and postable', async () => {
    app = await buildTestApp();

    // Mock account validation — accounts exist and are postable
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1100', isPostable: true, isActive: true, name: 'Trade Debtors' },
      { code: '4000', isPostable: true, isActive: true, name: 'Sales Revenue' },
    ]);

    // Mock $transaction to execute upserts
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.accountMapping.upsert.mockResolvedValue({});

    // After update, return the updated mappings
    mockPrisma.accountMapping.findMany.mockResolvedValue([
      makeMappingRow('AR_CONTROL', '1100', 'Accounts Receivable Control', 'Trade Debtors'),
      makeMappingRow('SALES_REVENUE', '4000', 'Default Sales Revenue', 'Sales Revenue'),
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [
        { mappingType: 'AR_CONTROL', accountCode: '1100' },
        { mappingType: 'SALES_REVENUE', accountCode: '4000' },
      ],
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('accepts departmentCode for department-scoped overrides', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '4100', isPostable: true, isActive: true, name: 'Sales - Services' },
    ]);

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.accountMapping.upsert.mockResolvedValue({});
    mockPrisma.accountMapping.findMany.mockResolvedValue([
      {
        ...makeMappingRow(
          'SALES_REVENUE',
          '4100',
          'Sales - Services Dept Override',
          'Sales - Services',
        ),
        departmentCode: 'SERVICES',
      },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [{ mappingType: 'SALES_REVENUE', accountCode: '4100', departmentCode: 'SERVICES' }],
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].departmentCode).toBe('SERVICES');
  });

  it('rejects non-existent account codes (BR-FIN-007)', async () => {
    app = await buildTestApp();

    // Account does not exist
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [{ mappingType: 'AR_CONTROL', accountCode: '9990' }],
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ACCOUNT_VALIDATION_FAILED');
    expect(body.error.details).toHaveProperty('9990');
  });

  it('rejects non-postable accounts (BR-FIN-013)', async () => {
    app = await buildTestApp();

    // Account exists but is not postable (header/group account)
    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1000', isPostable: false, isActive: true, name: 'Current Assets' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [{ mappingType: 'AR_CONTROL', accountCode: '1000' }],
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ACCOUNT_VALIDATION_FAILED');
    expect(body.error.details?.['1000']?.[0]).toContain('not postable');
  });

  it('rejects inactive accounts', async () => {
    app = await buildTestApp();

    mockPrisma.chartOfAccount.findMany.mockResolvedValue([
      { code: '1100', isPostable: true, isActive: false, name: 'Closed Account' },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [{ mappingType: 'AR_CONTROL', accountCode: '1100' }],
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('ACCOUNT_VALIDATION_FAILED');
    expect(body.error.details?.['1100']?.[0]).toContain('not active');
  });

  it('rejects invalid mapping type in body', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [{ mappingType: 'NONEXISTENT_TYPE', accountCode: '1100' }],
    });

    // Zod schema validation rejects invalid enum values → 400
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty array body', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: [],
    });

    // Zod .min(1) rejects empty array → 400
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/finance/account-mappings',
      headers: { 'content-type': 'application/json' },
      payload: [{ mappingType: 'AR_CONTROL', accountCode: '1100' }],
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/account-mappings/reset — AC-3
// ---------------------------------------------------------------------------

describe('POST /finance/account-mappings/reset', () => {
  it('deletes all mappings and re-inserts FRS 102 defaults', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.accountMapping.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.accountMapping.createMany.mockResolvedValue({ count: 27 });

    // After reset, return the default mappings
    const defaultRows = FRS102_DEFAULT_MAPPINGS.map((m) =>
      makeMappingRow(m.mappingType, m.accountCode, m.description),
    );
    mockPrisma.accountMapping.findMany.mockResolvedValue(defaultRows);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/account-mappings/reset',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(27);

    // Verify deleteMany was called
    expect(mockPrisma.accountMapping.deleteMany).toHaveBeenCalledWith({
      where: { companyId: TEST_COMPANY_ID },
    });

    // Verify createMany was called with all 27 defaults
    expect(mockPrisma.accountMapping.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          mappingType: 'AR_CONTROL',
          accountCode: '1100',
        }),
        expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          mappingType: 'ROUNDING',
          accountCode: '7700',
        }),
      ]),
    });

    // Verify exactly 27 mapping records were passed to createMany
    const createManyCall = mockPrisma.accountMapping.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(27);
  });

  it('returns all 27 mapping types in response', async () => {
    app = await buildTestApp();

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    mockPrisma.accountMapping.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.accountMapping.createMany.mockResolvedValue({ count: 27 });

    const defaultRows = FRS102_DEFAULT_MAPPINGS.map((m) =>
      makeMappingRow(m.mappingType, m.accountCode, m.description),
    );
    mockPrisma.accountMapping.findMany.mockResolvedValue(defaultRows);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/account-mappings/reset',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    const body = res.json();
    const mappingTypes = body.data.map((m: { mappingType: string }) => m.mappingType);

    // All 27 types should be present
    expect(mappingTypes).toContain('AR_CONTROL');
    expect(mappingTypes).toContain('AP_CONTROL');
    expect(mappingTypes).toContain('SALES_REVENUE');
    expect(mappingTypes).toContain('VAT_INPUT');
    expect(mappingTypes).toContain('VAT_OUTPUT');
    expect(mappingTypes).toContain('RETAINED_EARNINGS');
    expect(mappingTypes).toContain('SUSPENSE');
    expect(mappingTypes).toContain('ROUNDING');
    expect(mappingTypes).toContain('EMPLOYER_PENSION');
    expect(mappingTypes).toHaveLength(27);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/account-mappings/reset',
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
      url: '/finance/account-mappings',
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
      url: '/finance/account-mappings',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: [{ mappingType: 'AR_CONTROL', accountCode: '1100' }],
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /account-mappings/reset', async () => {
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
      url: '/finance/account-mappings/reset',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

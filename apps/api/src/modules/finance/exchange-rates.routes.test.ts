import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    drain: vi.fn(),
  },
  mockPrisma: {
    user: { findUnique: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    exchangeRate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
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
  Prisma: {
    Decimal: class Decimal {
      private value: number;
      constructor(val: number | string) {
        this.value = typeof val === 'string' ? parseFloat(val) : val;
      }
      toNumber() {
        return this.value;
      }
      toString() {
        return String(this.value);
      }
    },
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
import { exchangeRatesRoutesPlugin } from './exchange-rates.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_RATE_ID = '22222222-2222-4000-a000-222222222222';

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
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(exchangeRatesRoutesPlugin, { prefix: '/finance' });

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
        permissions: hasAccess
          ? { 'finance.exchangeRates': fullPerm, 'finance.accounts': fullPerm }
          : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

/** Sample exchange rate data matching the Prisma model shape */
function makeSampleRate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_RATE_ID,
    companyId: TEST_COMPANY_ID,
    currencyCode: 'USD',
    rateDate: new Date('2026-03-31'),
    buyRate: 1.262,
    sellRate: 1.268,
    midRate: 1.265,
    source: 'MANUAL',
    createdAt: new Date('2026-03-31T00:00:00Z'),
    updatedAt: new Date('2026-03-31T00:00:00Z'),
    ...overrides,
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
// GET /finance/exchange-rates — AC-1: list with filters
// ---------------------------------------------------------------------------

describe('GET /finance/exchange-rates', () => {
  it('returns list of exchange rates with pagination meta', async () => {
    app = await buildTestApp();
    const rates = [
      makeSampleRate(),
      makeSampleRate({
        id: '33333333-3333-4000-a000-333333333333',
        currencyCode: 'EUR',
        buyRate: 1.168,
        sellRate: 1.174,
        midRate: 1.171,
      }),
    ];

    mockPrisma.exchangeRate.findMany.mockResolvedValue(rates);
    mockPrisma.exchangeRate.count.mockResolvedValue(2);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].currencyCode).toBe('USD');
    expect(body.data[1].currencyCode).toBe('EUR');
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it('filters by currencyCode', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.findMany.mockResolvedValue([]);
    mockPrisma.exchangeRate.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates?currencyCode=EUR',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, currencyCode: 'EUR' }),
      }),
    );
  });

  it('filters by date range', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.findMany.mockResolvedValue([]);
    mockPrisma.exchangeRate.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates?dateFrom=2026-01-01&dateTo=2026-03-31',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          rateDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      }),
    );
  });

  it('filters by source', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.findMany.mockResolvedValue([]);
    mockPrisma.exchangeRate.count.mockResolvedValue(0);

    await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates?source=BOE',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID, source: 'BOE' }),
      }),
    );
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/exchange-rates — AC-2: create manual rate
// ---------------------------------------------------------------------------

describe('POST /finance/exchange-rates', () => {
  it('creates a new exchange rate successfully', async () => {
    app = await buildTestApp();
    const created = makeSampleRate();

    mockPrisma.exchangeRate.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        buyRate: 1.262,
        sellRate: 1.268,
        midRate: 1.265,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.currencyCode).toBe('USD');
    expect(body.data.buyRate).toBe(1.262);
    expect(body.data.sellRate).toBe(1.268);
    expect(body.data.midRate).toBe(1.265);
    expect(body.data.source).toBe('MANUAL');
  });

  it('rejects invalid currency code (not 3 uppercase letters)', async () => {
    app = await buildTestApp();

    const invalidCodes = ['US', 'USDX', 'usd', '123', 'U$D'];

    for (const currencyCode of invalidCodes) {
      const res = await app.inject({
        method: 'POST',
        url: '/finance/exchange-rates',
        headers: {
          authorization: `Bearer ${testJwt}`,
          'content-type': 'application/json',
        },
        payload: {
          currencyCode,
          rateDate: '2026-03-31',
          buyRate: 1.262,
          sellRate: 1.268,
          midRate: 1.265,
        },
      });

      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects negative rates', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        buyRate: -1.262,
        sellRate: 1.268,
        midRate: 1.265,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 for duplicate rate (same currency + date)', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.create.mockRejectedValue({ code: 'P2002' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        buyRate: 1.262,
        sellRate: 1.268,
        midRate: 1.265,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('DUPLICATE_RATE');
  });

  it('defaults source to MANUAL', async () => {
    app = await buildTestApp();
    const created = makeSampleRate();
    mockPrisma.exchangeRate.create.mockResolvedValue(created);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        buyRate: 1.262,
        sellRate: 1.268,
        midRate: 1.265,
      },
    });

    expect(res.statusCode).toBe(201);
    // Verify the service was called with source MANUAL
    expect(mockPrisma.exchangeRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'MANUAL' }),
      }),
    );
  });

  it('requires all rate fields', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        // Missing buyRate, sellRate, midRate
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates',
      headers: { 'content-type': 'application/json' },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        buyRate: 1.262,
        sellRate: 1.268,
        midRate: 1.265,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /finance/exchange-rates/fetch — AC-3: BOE fetch stub
// ---------------------------------------------------------------------------

describe('POST /finance/exchange-rates/fetch', () => {
  it('triggers BOE fetch and returns created rates', async () => {
    app = await buildTestApp();

    const usdRate = makeSampleRate({ source: 'BOE' });
    const eurRate = makeSampleRate({
      id: '33333333-3333-4000-a000-333333333333',
      currencyCode: 'EUR',
      buyRate: 1.168,
      sellRate: 1.174,
      midRate: 1.171,
      source: 'BOE',
    });

    // First call creates USD, second creates EUR
    mockPrisma.exchangeRate.create.mockResolvedValueOnce(usdRate).mockResolvedValueOnce(eurRate);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/fetch',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencies: ['USD', 'EUR'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.fetched).toBe(2);
    expect(body.data.rates).toHaveLength(2);
  });

  it('skips duplicates silently during fetch', async () => {
    app = await buildTestApp();

    const usdRate = makeSampleRate({ source: 'BOE' });
    // First creates successfully, second is a duplicate
    mockPrisma.exchangeRate.create
      .mockResolvedValueOnce(usdRate)
      .mockRejectedValueOnce({ code: 'P2002' });

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/fetch',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencies: ['USD', 'EUR'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.fetched).toBe(1);
    expect(body.data.rates).toHaveLength(1);
  });

  it('defaults to USD and EUR when no currencies specified', async () => {
    app = await buildTestApp();

    const usdRate = makeSampleRate({ source: 'BOE' });
    const eurRate = makeSampleRate({
      id: '33333333-3333-4000-a000-333333333333',
      currencyCode: 'EUR',
      source: 'BOE',
    });

    mockPrisma.exchangeRate.create.mockResolvedValueOnce(usdRate).mockResolvedValueOnce(eurRate);

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/fetch',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.fetched).toBe(2);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/exchange-rates/fetch',
      headers: { 'content-type': 'application/json' },
      payload: { currencies: ['USD'] },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /finance/exchange-rates/latest/:currencyCode — AC-4: latest rate
// ---------------------------------------------------------------------------

describe('GET /finance/exchange-rates/latest/:currencyCode', () => {
  it('returns the latest rate for a given currency', async () => {
    app = await buildTestApp();
    const rate = makeSampleRate();

    mockPrisma.exchangeRate.findFirst.mockResolvedValue(rate);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates/latest/USD',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.currencyCode).toBe('USD');
    expect(body.data.midRate).toBe(1.265);
  });

  it('returns 404 when no rate exists for the currency', async () => {
    app = await buildTestApp();
    mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates/latest/XYZ',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects invalid currency code in path', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates/latest/us',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/finance/exchange-rates/latest/USD',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission checks (AC-5)
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('returns 403 for VIEWER role on GET /exchange-rates', async () => {
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
      url: '/finance/exchange-rates',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /exchange-rates', async () => {
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
      url: '/finance/exchange-rates',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: {
        currencyCode: 'USD',
        rateDate: '2026-03-31',
        buyRate: 1.262,
        sellRate: 1.268,
        midRate: 1.265,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on POST /exchange-rates/fetch', async () => {
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
      url: '/finance/exchange-rates/fetch',
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { currencies: ['USD'] },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for VIEWER role on GET /exchange-rates/latest/:currencyCode', async () => {
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
      url: '/finance/exchange-rates/latest/USD',
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

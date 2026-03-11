// ---------------------------------------------------------------------------
// Unit tests — Print Preference Routes (E13-1 Task 3.4)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the routes
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockGetPreferences,
  mockUpdateUserPreferences,
  mockGetCompanyDefaults,
  mockUpdateCompanyDefaults,
  mockResetUserPreferences,
} = vi.hoisted(() => ({
  mockPrisma: {
    printPreference: {
      deleteMany: vi.fn(),
    },
  },
  mockGetPreferences: vi.fn(),
  mockUpdateUserPreferences: vi.fn(),
  mockGetCompanyDefaults: vi.fn(),
  mockUpdateCompanyDefaults: vi.fn(),
  mockResetUserPreferences: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  DocumentType: {
    SALES_INVOICE: 'SALES_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    CASH_RECEIPT: 'CASH_RECEIPT',
    PROFORMA_INVOICE: 'PROFORMA_INVOICE',
    CUSTOMER_STATEMENT: 'CUSTOMER_STATEMENT',
    SALES_ORDER: 'SALES_ORDER',
    SALES_QUOTE: 'SALES_QUOTE',
    DELIVERY_NOTE: 'DELIVERY_NOTE',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    GOODS_RECEIPT_NOTE: 'GOODS_RECEIPT_NOTE',
    SUPPLIER_REMITTANCE: 'SUPPLIER_REMITTANCE',
    PAYSLIP: 'PAYSLIP',
    P45: 'P45',
    P60: 'P60',
  },
  PrintAction: {
    AUTO_DOWNLOAD: 'AUTO_DOWNLOAD',
    BROWSER_PRINT: 'BROWSER_PRINT',
    NONE: 'NONE',
  },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('@nexa/i18n/server', () => ({
  tServer: (key: string) => key,
}));

vi.mock('../services/print-preference.service.js', () => ({
  PrintPreferenceService: class MockPrintPreferenceService {
    getPreferences = mockGetPreferences;
    updateUserPreferences = mockUpdateUserPreferences;
    getCompanyDefaults = mockGetCompanyDefaults;
    updateCompanyDefaults = mockUpdateCompanyDefaults;
    resetUserPreferences = mockResetUserPreferences;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RouteHandler {
  method: string;
  url: string;
  opts: Record<string, unknown>;
  handler: (request: Record<string, unknown>, reply: Record<string, unknown>) => Promise<unknown>;
}

function createMockFastify() {
  const routes: RouteHandler[] = [];

  const fastify = {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    get: vi.fn((url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
      routes.push({ method: 'GET', url, opts, handler });
    }),
    put: vi.fn((url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
      routes.push({ method: 'PUT', url, opts, handler });
    }),
    delete: vi.fn(
      (url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
        routes.push({ method: 'DELETE', url, opts, handler });
      },
    ),
    register: vi.fn(),
  };

  return { fastify, routes };
}

function createMockReply() {
  const reply: Record<string, unknown> = {};
  reply.header = vi.fn().mockReturnValue(reply);
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply as {
    header: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

function createMockRequest(overrides?: Record<string, unknown>) {
  return {
    companyId: 'company-001',
    userId: 'user-001',
    userRole: 'STAFF',
    tenantId: 'tenant-001',
    enabledModules: [],
    ...overrides,
  };
}

function buildPreferencesResponse() {
  return [
    { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD', source: 'USER' },
    { documentType: 'CREDIT_NOTE', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'CASH_RECEIPT', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'PROFORMA_INVOICE', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'CUSTOMER_STATEMENT', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'SALES_ORDER', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'SALES_QUOTE', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'DELIVERY_NOTE', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT', source: 'COMPANY_DEFAULT' },
    { documentType: 'GOODS_RECEIPT_NOTE', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'SUPPLIER_REMITTANCE', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'PAYSLIP', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'P45', action: 'NONE', source: 'FALLBACK' },
    { documentType: 'P60', action: 'NONE', source: 'FALLBACK' },
  ];
}

function buildCompanyDefaultsResponse() {
  return [
    { documentType: 'SALES_INVOICE', action: 'NONE' },
    { documentType: 'CREDIT_NOTE', action: 'NONE' },
    { documentType: 'CASH_RECEIPT', action: 'NONE' },
    { documentType: 'PROFORMA_INVOICE', action: 'NONE' },
    { documentType: 'CUSTOMER_STATEMENT', action: 'NONE' },
    { documentType: 'SALES_ORDER', action: 'NONE' },
    { documentType: 'SALES_QUOTE', action: 'NONE' },
    { documentType: 'DELIVERY_NOTE', action: 'NONE' },
    { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT' },
    { documentType: 'GOODS_RECEIPT_NOTE', action: 'NONE' },
    { documentType: 'SUPPLIER_REMITTANCE', action: 'NONE' },
    { documentType: 'PAYSLIP', action: 'NONE' },
    { documentType: 'P45', action: 'NONE' },
    { documentType: 'P60', action: 'NONE' },
  ];
}

async function registerRoutes() {
  const { printPreferenceRoutesPlugin } = await import('./print-preference.routes.js');
  const { fastify, routes } = createMockFastify();
  await printPreferenceRoutesPlugin(fastify as never);
  return { fastify, routes };
}

function findRoute(routes: RouteHandler[], method: string, url: string) {
  return routes.find((r) => r.method === method && r.url === url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Print Preference Routes (Task 3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Route registration
  // -------------------------------------------------------------------------

  describe('route registration', () => {
    it('registers all 5 expected routes', async () => {
      const { routes } = await registerRoutes();

      expect(findRoute(routes, 'GET', '/print-preferences')).toBeDefined();
      expect(findRoute(routes, 'PUT', '/print-preferences')).toBeDefined();
      expect(findRoute(routes, 'GET', '/print-preferences/company-defaults')).toBeDefined();
      expect(findRoute(routes, 'PUT', '/print-preferences/company-defaults')).toBeDefined();
      expect(findRoute(routes, 'DELETE', '/print-preferences/reset')).toBeDefined();
    });

    it('GET /print-preferences has RBAC preHandler', async () => {
      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'GET', '/print-preferences');
      expect(route!.opts.preHandler).toBeDefined();
    });

    it('PUT /print-preferences has body schema and RBAC preHandler', async () => {
      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'PUT', '/print-preferences');
      expect(route!.opts.preHandler).toBeDefined();
      const schema = route!.opts.schema as Record<string, unknown>;
      expect(schema.body).toBeDefined();
    });

    it('GET /print-preferences/company-defaults has RBAC preHandler', async () => {
      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'GET', '/print-preferences/company-defaults');
      expect(route!.opts.preHandler).toBeDefined();
    });

    it('PUT /print-preferences/company-defaults has body schema and RBAC preHandler', async () => {
      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'PUT', '/print-preferences/company-defaults');
      expect(route!.opts.preHandler).toBeDefined();
      const schema = route!.opts.schema as Record<string, unknown>;
      expect(schema.body).toBeDefined();
    });

    it('DELETE /print-preferences/reset has RBAC preHandler', async () => {
      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'DELETE', '/print-preferences/reset');
      expect(route!.opts.preHandler).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // GET /print-preferences
  // -------------------------------------------------------------------------

  describe('GET /print-preferences', () => {
    it('returns resolved preferences for the current user', async () => {
      const preferences = buildPreferencesResponse();
      mockGetPreferences.mockResolvedValue(preferences);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'GET', '/print-preferences')!;
      const request = createMockRequest();
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockGetPreferences).toHaveBeenCalledWith('company-001', 'user-001');
      expect(reply.send).toHaveBeenCalledWith(preferences);
    });

    it('uses companyId and userId from request context', async () => {
      mockGetPreferences.mockResolvedValue([]);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'GET', '/print-preferences')!;
      const request = createMockRequest({ companyId: 'company-999', userId: 'user-999' });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockGetPreferences).toHaveBeenCalledWith('company-999', 'user-999');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /print-preferences
  // -------------------------------------------------------------------------

  describe('PUT /print-preferences', () => {
    it('updates user preferences and returns resolved result', async () => {
      const updatedPreferences = buildPreferencesResponse();
      mockUpdateUserPreferences.mockResolvedValue(undefined);
      mockGetPreferences.mockResolvedValue(updatedPreferences);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'PUT', '/print-preferences')!;
      const request = createMockRequest({
        body: {
          preferences: [{ documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' }],
        },
      });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith('company-001', 'user-001', [
        { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' },
      ]);
      expect(mockGetPreferences).toHaveBeenCalledWith('company-001', 'user-001');
      expect(reply.send).toHaveBeenCalledWith(updatedPreferences);
    });

    it('passes multiple preferences to the service', async () => {
      mockUpdateUserPreferences.mockResolvedValue(undefined);
      mockGetPreferences.mockResolvedValue(buildPreferencesResponse());

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'PUT', '/print-preferences')!;
      const preferences = [
        { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' },
        { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT' },
      ];
      const request = createMockRequest({ body: { preferences } });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
        'company-001',
        'user-001',
        preferences,
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /print-preferences/company-defaults
  // -------------------------------------------------------------------------

  describe('GET /print-preferences/company-defaults', () => {
    it('returns company defaults for the current company', async () => {
      const defaults = buildCompanyDefaultsResponse();
      mockGetCompanyDefaults.mockResolvedValue(defaults);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'GET', '/print-preferences/company-defaults')!;
      const request = createMockRequest();
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockGetCompanyDefaults).toHaveBeenCalledWith('company-001');
      expect(reply.send).toHaveBeenCalledWith(defaults);
    });

    it('uses companyId from request context', async () => {
      mockGetCompanyDefaults.mockResolvedValue([]);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'GET', '/print-preferences/company-defaults')!;
      const request = createMockRequest({ companyId: 'company-777' });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockGetCompanyDefaults).toHaveBeenCalledWith('company-777');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /print-preferences/company-defaults
  // -------------------------------------------------------------------------

  describe('PUT /print-preferences/company-defaults', () => {
    it('updates company defaults and returns updated result', async () => {
      const updatedDefaults = buildCompanyDefaultsResponse();
      mockUpdateCompanyDefaults.mockResolvedValue(undefined);
      mockGetCompanyDefaults.mockResolvedValue(updatedDefaults);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'PUT', '/print-preferences/company-defaults')!;
      const request = createMockRequest({
        body: {
          defaults: [{ documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT' }],
        },
      });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockUpdateCompanyDefaults).toHaveBeenCalledWith('company-001', [
        { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT' },
      ]);
      expect(mockGetCompanyDefaults).toHaveBeenCalledWith('company-001');
      expect(reply.send).toHaveBeenCalledWith(updatedDefaults);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /print-preferences/reset
  // -------------------------------------------------------------------------

  describe('DELETE /print-preferences/reset', () => {
    it('delegates to service.resetUserPreferences and returns resolved defaults', async () => {
      mockResetUserPreferences.mockResolvedValue(undefined);
      const defaults = buildPreferencesResponse().map((p) => ({
        ...p,
        source: p.source === 'USER' ? 'FALLBACK' : p.source,
        action: p.source === 'USER' ? 'NONE' : p.action,
      }));
      mockGetPreferences.mockResolvedValue(defaults);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'DELETE', '/print-preferences/reset')!;
      const request = createMockRequest();
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockResetUserPreferences).toHaveBeenCalledWith('company-001', 'user-001');
      expect(mockGetPreferences).toHaveBeenCalledWith('company-001', 'user-001');
      expect(reply.send).toHaveBeenCalledWith(defaults);
    });

    it('scopes reset to current user and company', async () => {
      mockResetUserPreferences.mockResolvedValue(undefined);
      mockGetPreferences.mockResolvedValue([]);

      const { routes } = await registerRoutes();
      const route = findRoute(routes, 'DELETE', '/print-preferences/reset')!;
      const request = createMockRequest({ companyId: 'company-555', userId: 'user-555' });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(mockResetUserPreferences).toHaveBeenCalledWith('company-555', 'user-555');
    });
  });

  // -------------------------------------------------------------------------
  // Schema validation — Zod schemas
  // -------------------------------------------------------------------------

  describe('schema validation', () => {
    it('updateUserPreferencesBodySchema rejects invalid documentType', async () => {
      const { updateUserPreferencesBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateUserPreferencesBodySchema.safeParse({
        preferences: [{ documentType: 'INVALID_TYPE', action: 'NONE' }],
      });
      expect(result.success).toBe(false);
    });

    it('updateUserPreferencesBodySchema rejects invalid action', async () => {
      const { updateUserPreferencesBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateUserPreferencesBodySchema.safeParse({
        preferences: [{ documentType: 'SALES_INVOICE', action: 'INVALID_ACTION' }],
      });
      expect(result.success).toBe(false);
    });

    it('updateUserPreferencesBodySchema rejects empty preferences array', async () => {
      const { updateUserPreferencesBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateUserPreferencesBodySchema.safeParse({
        preferences: [],
      });
      expect(result.success).toBe(false);
    });

    it('updateUserPreferencesBodySchema accepts valid input', async () => {
      const { updateUserPreferencesBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateUserPreferencesBodySchema.safeParse({
        preferences: [
          { documentType: 'SALES_INVOICE', action: 'AUTO_DOWNLOAD' },
          { documentType: 'PURCHASE_ORDER', action: 'BROWSER_PRINT' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('updateCompanyDefaultsBodySchema rejects invalid documentType', async () => {
      const { updateCompanyDefaultsBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateCompanyDefaultsBodySchema.safeParse({
        defaults: [{ documentType: 'BAD_TYPE', action: 'NONE' }],
      });
      expect(result.success).toBe(false);
    });

    it('updateCompanyDefaultsBodySchema rejects invalid action', async () => {
      const { updateCompanyDefaultsBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateCompanyDefaultsBodySchema.safeParse({
        defaults: [{ documentType: 'SALES_INVOICE', action: 'PRINT_AND_MAIL' }],
      });
      expect(result.success).toBe(false);
    });

    it('updateCompanyDefaultsBodySchema accepts valid input', async () => {
      const { updateCompanyDefaultsBodySchema } =
        await import('../schemas/print-preference.schema.js');
      const result = updateCompanyDefaultsBodySchema.safeParse({
        defaults: [{ documentType: 'CREDIT_NOTE', action: 'NONE' }],
      });
      expect(result.success).toBe(true);
    });
  });
});

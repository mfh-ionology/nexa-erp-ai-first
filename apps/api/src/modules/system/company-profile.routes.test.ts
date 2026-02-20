import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockLoadDefaultData } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    userCompanyRole: { create: vi.fn() },
    companyProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    numberSeries: { createMany: vi.fn() },
    userAccessGroup: { findMany: vi.fn(), create: vi.fn() },
    accessGroup: { create: vi.fn() },
    accessGroupPermission: { findMany: vi.fn(), createMany: vi.fn() },
    accessGroupFieldOverride: { findMany: vi.fn(), createMany: vi.fn() },
    resource: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockResolveUserRole: vi.fn(),
  mockLoadDefaultData: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  loadDefaultData: mockLoadDefaultData,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  VatScheme: {
    STANDARD: 'STANDARD',
    FLAT_RATE: 'FLAT_RATE',
    CASH: 'CASH',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { companyProfileRoutesPlugin } from './company-profile.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';
import { permissionCache } from '../../core/rbac/index.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const NEW_COMPANY_ID = '33333333-3333-4000-a000-333333333333';

const now = new Date();

/** Sample company profile matching the Prisma model shape. */
function sampleCompanyProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_COMPANY_ID,
    name: 'Acme Ltd',
    legalName: 'Acme Limited',
    registrationNumber: '12345678',
    vatNumber: 'GB123456789',
    utrNumber: null,
    natureOfBusiness: 'Technology',
    baseCurrencyCode: 'GBP',
    isDefault: true,
    isActive: true,

    // Address
    addressLine1: '123 High Street',
    addressLine2: null,
    city: 'London',
    county: 'Greater London',
    postcode: 'EC1A 1BB',
    countryCode: 'GB',

    // Contact
    phone: '+44 20 7946 0958',
    email: 'info@acme.co.uk',
    website: null,

    // Configuration
    timezone: 'Europe/London',
    weekStart: 1,
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    vatScheme: 'STANDARD',
    defaultLanguage: 'en',

    // Tax Agent
    taxAgentName: null,
    taxAgentPhone: null,
    taxAgentEmail: null,

    // Branding
    logoUrl: null,

    // Audit
    createdAt: now,
    updatedAt: now,
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,

    ...overrides,
  };
}

/** Build a minimal Fastify app with jwt-verify + company-context + company-profile routes. */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(companyProfileRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

/**
 * Configure mocks for the company-context middleware and service calls.
 *
 * @param config.role — role returned by resolveUserRole (for company-context middleware)
 * @param config.hasPermissions — whether to grant full permissions (default true).
 *   When false, userAccessGroup returns [] so the user has no permissions at all.
 */
function setupMocks(config: { role?: string; hasPermissions?: boolean } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';
  const hasPermissions = config.hasPermissions ?? true;

  // Company-context middleware: look up requesting user
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  // Company-context middleware: verify target company exists & is active
  // Also used by getCompanyProfile service (returns full profile)
  mockPrisma.companyProfile.findUnique.mockResolvedValue(sampleCompanyProfile());

  mockResolveUserRole.mockResolvedValue(resolvedRole);

  // Permission resolution (used by createPermissionGuard)
  if (hasPermissions) {
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([{ accessGroupId: 'mock-group-id' }]);
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue([
      {
        resourceCode: 'system.company-profile',
        canAccess: true,
        canView: true,
        canNew: true,
        canEdit: true,
        canDelete: true,
      },
    ]);
    mockPrisma.accessGroupFieldOverride.findMany.mockResolvedValue([]);
    mockPrisma.resource.findMany.mockResolvedValue([
      { code: 'system.company-profile', module: 'system' },
    ]);
  } else {
    // No access groups → no permissions at all
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([]);
    mockPrisma.accessGroupPermission.findMany.mockResolvedValue([]);
    mockPrisma.accessGroupFieldOverride.findMany.mockResolvedValue([]);
  }

  // loadDefaultData: return minimal defaults for company creation
  mockLoadDefaultData.mockReturnValue({
    accessGroups: [
      {
        code: 'FULL_ACCESS',
        name: 'Full Access',
        description: 'Full access to all modules',
        isSystem: true,
        permissions: [
          {
            resourceCode: 'system.company-profile',
            canAccess: true,
            canNew: true,
            canView: true,
            canEdit: true,
            canDelete: true,
          },
        ],
        fieldOverrides: [],
      },
    ],
  });

  // accessGroup.create: return a mock group with an id
  mockPrisma.accessGroup.create.mockResolvedValue({ id: 'mock-full-access-group-id' });

  // accessGroupPermission.createMany / accessGroupFieldOverride.createMany (for seeding)
  mockPrisma.accessGroupPermission.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.accessGroupFieldOverride.createMany.mockResolvedValue({ count: 0 });

  // userAccessGroup.create: for assigning FULL_ACCESS group to creating user
  mockPrisma.userAccessGroup.create.mockResolvedValue({});

  // $transaction: call the callback with mockPrisma as the tx object
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  permissionCache.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Company Profile routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  const validCreatePayload = {
    name: 'New Company Ltd',
    legalName: 'New Company Limited',
    vatNumber: 'GB987654321',
    baseCurrencyCode: 'GBP',
  };

  // =========================================================================
  // GET /system/company-profile
  // =========================================================================

  describe('GET /system/company-profile', () => {
    // 10.2 — 200 with current company data (uses ctx.companyId)
    it('returns 200 with current company data using ctx.companyId (10.2)', async () => {
      setupMocks();

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/company-profile',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEST_COMPANY_ID);
      expect(body.data.name).toBe('Acme Ltd');
      expect(body.data.legalName).toBe('Acme Limited');
      expect(body.data.baseCurrencyCode).toBe('GBP');
      expect(body.data.vatScheme).toBe('STANDARD');
      expect(body.data.isActive).toBe(true);

      // Verify companyProfile.findUnique was called with the correct companyId
      expect(mockPrisma.companyProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_COMPANY_ID } }),
      );
    });

    // 10.7 — VIEWER role → 200 (any authenticated user allowed)
    it('allows VIEWER role to access company profile (10.7)', async () => {
      setupMocks({ role: 'VIEWER' });

      app = await buildTestApp();

      const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
      const res = await app.inject({
        method: 'GET',
        url: '/system/company-profile',
        headers: authHeaders(viewerJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEST_COMPANY_ID);
    });
  });

  // =========================================================================
  // POST /system/company-profile
  // =========================================================================

  describe('POST /system/company-profile', () => {
    // 10.3 — Valid data → 201, company + default number series created
    it('creates company with valid data and returns 201 (10.3)', async () => {
      setupMocks();

      const createdProfile = sampleCompanyProfile({
        id: NEW_COMPANY_ID,
        name: 'New Company Ltd',
        legalName: 'New Company Limited',
        vatNumber: 'GB987654321',
      });
      mockPrisma.companyProfile.create.mockResolvedValue(createdProfile);
      mockPrisma.numberSeries.createMany.mockResolvedValue({ count: 9 });
      mockPrisma.userCompanyRole.create.mockResolvedValue({});

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('New Company Ltd');
      expect(body.data.legalName).toBe('New Company Limited');
      expect(body.data.vatNumber).toBe('GB987654321');

      // Verify transaction was used for atomicity
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify company was created with audit fields
      expect(mockPrisma.companyProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Company Ltd',
            createdBy: TEST_USER_ID,
            updatedBy: TEST_USER_ID,
          }),
        }),
      );

      // Verify creating user gets ADMIN access to new company
      expect(mockPrisma.userCompanyRole.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          companyId: NEW_COMPANY_ID,
          role: 'ADMIN',
        },
      });
    });

    // 10.4 — Verifies all 9 default NumberSeries records exist
    it('creates all 9 default NumberSeries records in transaction (10.4)', async () => {
      setupMocks();

      const createdProfile = sampleCompanyProfile({ id: NEW_COMPANY_ID });
      mockPrisma.companyProfile.create.mockResolvedValue(createdProfile);
      mockPrisma.numberSeries.createMany.mockResolvedValue({ count: 9 });
      mockPrisma.userCompanyRole.create.mockResolvedValue({});

      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: '/system/company-profile',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      // Verify numberSeries.createMany was called
      expect(mockPrisma.numberSeries.createMany).toHaveBeenCalledTimes(1);

      const createManyCall = mockPrisma.numberSeries.createMany.mock.calls[0]![0];
      const seriesData = createManyCall.data as Array<{
        companyId: string;
        entityType: string;
        prefix: string;
        nextValue: number;
        padding: number;
        isActive: boolean;
      }>;

      // Verify exactly 9 records
      expect(seriesData).toHaveLength(9);

      // Verify all expected entity types and prefixes
      const expectedSeries = [
        { entityType: 'INVOICE', prefix: 'INV-' },
        { entityType: 'CREDIT_NOTE', prefix: 'CN-' },
        { entityType: 'SALES_ORDER', prefix: 'SO-' },
        { entityType: 'SALES_QUOTE', prefix: 'SQ-' },
        { entityType: 'PURCHASE_ORDER', prefix: 'PO-' },
        { entityType: 'JOURNAL', prefix: 'JNL-' },
        { entityType: 'CUSTOMER', prefix: 'CUST-' },
        { entityType: 'SUPPLIER', prefix: 'SUP-' },
        { entityType: 'EMPLOYEE', prefix: 'EMP-' },
      ];

      for (const expected of expectedSeries) {
        const match = seriesData.find(
          (s) => s.entityType === expected.entityType && s.prefix === expected.prefix,
        );
        expect(match).toBeDefined();
        expect(match!.nextValue).toBe(1);
        expect(match!.padding).toBe(5);
        expect(match!.isActive).toBe(true);
        expect(match!.companyId).toBe(NEW_COMPANY_ID);
      }
    });

    // 10.6 — User with no permissions → 403 FORBIDDEN
    it('denies user with no permissions with 403 FORBIDDEN (10.6)', async () => {
      setupMocks({ role: 'STAFF', hasPermissions: false });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile',
        headers: authHeaders(testJwt),
        payload: validCreatePayload,
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // PATCH /system/company-profile
  // =========================================================================

  describe('PATCH /system/company-profile', () => {
    // 10.5 — Valid update → 200, fields updated
    it('updates company profile and returns 200 (10.5)', async () => {
      setupMocks();

      const updatedProfile = sampleCompanyProfile({
        name: 'Acme Corp',
        vatNumber: 'GB999999999',
      });
      mockPrisma.companyProfile.update.mockResolvedValue(updatedProfile);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: '/system/company-profile',
        headers: authHeaders(testJwt),
        payload: { name: 'Acme Corp', vatNumber: 'GB999999999' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Acme Corp');
      expect(body.data.vatNumber).toBe('GB999999999');

      // Verify update was called with correct companyId and audit field
      expect(mockPrisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_COMPANY_ID },
          data: expect.objectContaining({
            name: 'Acme Corp',
            vatNumber: 'GB999999999',
            updatedBy: TEST_USER_ID,
          }),
        }),
      );
    });
  });
});

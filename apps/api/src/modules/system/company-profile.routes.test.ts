import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockResolveUserRole,
  mockLoadDefaultAccessGroups,
  mockAssignFullAccessGroup,
  mockPermissionService,
  mockEventBus,
} = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    userCompanyRole: { create: vi.fn() },
    companyProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    numberSeries: { createMany: vi.fn() },
    accessGroup: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    accessGroupPermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    accessGroupFieldOverride: { deleteMany: vi.fn(), createMany: vi.fn() },
    userAccessGroup: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockEventBus: { emit: vi.fn() },
  mockResolveUserRole: vi.fn(),
  mockLoadDefaultAccessGroups: vi.fn().mockResolvedValue({ created: 12, updated: 0 }),
  mockAssignFullAccessGroup: vi.fn().mockResolvedValue(undefined),
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
  loadDefaultAccessGroups: mockLoadDefaultAccessGroups,
  assignFullAccessGroup: mockAssignFullAccessGroup,
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
  FieldVisibility: {
    VISIBLE: 'VISIBLE',
    READ_ONLY: 'READ_ONLY',
    HIDDEN: 'HIDDEN',
  },
}));

vi.mock('../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: {
    new: 'canNew',
    view: 'canView',
    edit: 'canEdit',
    delete: 'canDelete',
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
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(companyProfileRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

/**
 * Configure mocks for the company-context middleware and service calls.
 */
function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';

  // Company-context middleware: look up requesting user
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  // Company-context middleware: verify target company exists & is active
  // Also used by getCompanyProfile service (returns full profile)
  mockPrisma.companyProfile.findUnique.mockResolvedValue(sampleCompanyProfile());

  mockResolveUserRole.mockResolvedValue(resolvedRole);

  // $transaction: call the callback with mockPrisma as the tx object
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );

  // Configure permission service mock
  if (resolvedRole === 'SUPER_ADMIN') {
    // Guard calls getEffectivePermissions even for SUPER_ADMIN (to populate request.permissions)
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: resolvedRole,
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else {
    const fullPerm = {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: true,
    };
    const viewOnlyPerm = {
      canAccess: true,
      canNew: false,
      canView: true,
      canEdit: false,
      canDelete: false,
    };
    const hasAccess = ['ADMIN', 'MANAGER'].includes(resolvedRole);
    const isViewer = resolvedRole === 'VIEWER';
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: hasAccess
        ? { 'system.company-profile.detail': fullPerm }
        : isViewer
          ? { 'system.company-profile.detail': viewOnlyPerm }
          : {},
      fieldOverrides: {},
      accessGroups: hasAccess ? [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }] : [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: hasAccess || isViewer ? ['system'] : [],
    });
  }
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

    // E2b-5 — Field filtering via onSend hook
    it('strips HIDDEN fields and annotates READ_ONLY via onSend hook (E2b-5)', async () => {
      setupMocks();

      // Override the mock to include field overrides for the company-profile resource
      mockPermissionService.getEffectivePermissions.mockResolvedValue({
        permissions: {
          'system.company-profile.detail': {
            canAccess: true,
            canNew: true,
            canView: true,
            canEdit: true,
            canDelete: true,
          },
        },
        fieldOverrides: {
          'system.company-profile.detail': {
            vatNumber: 'HIDDEN',
            registrationNumber: 'READ_ONLY',
          },
        },
        accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
        role: 'ADMIN',
        isSuperAdmin: false,
        enabledModules: ['system'],
      });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/company-profile',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      // vatNumber should be stripped (HIDDEN)
      expect(body.data.vatNumber).toBeUndefined();
      // registrationNumber should be present (READ_ONLY) with _fieldMeta
      expect(body.data.registrationNumber).toBe('12345678');
      expect(body._fieldMeta).toEqual({ registrationNumber: 'readOnly' });
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

      // Verify default access groups and FULL_ACCESS assignment were seeded
      expect(mockLoadDefaultAccessGroups).toHaveBeenCalledWith(
        mockPrisma,
        NEW_COMPANY_ID,
        TEST_USER_ID,
      );
      expect(mockAssignFullAccessGroup).toHaveBeenCalledWith(
        mockPrisma,
        NEW_COMPANY_ID,
        TEST_USER_ID,
      );
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

    // 10.6 — STAFF role → 403 FORBIDDEN
    it('denies STAFF role with 403 FORBIDDEN (10.6)', async () => {
      setupMocks({ role: 'STAFF' });

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

  // =========================================================================
  // GET /system/company-profile/export-defaults
  // =========================================================================

  describe('GET /system/company-profile/export-defaults', () => {
    const sampleGroups = [
      {
        id: 'ag-1',
        companyId: TEST_COMPANY_ID,
        code: 'FULL_ACCESS',
        name: 'Full Access',
        description: 'All permissions',
        isSystem: true,
        isActive: true,
        createdBy: TEST_USER_ID,
        updatedBy: TEST_USER_ID,
        permissions: [
          {
            resourceCode: 'system.users.list',
            canAccess: true,
            canNew: true,
            canView: true,
            canEdit: true,
            canDelete: true,
          },
        ],
        fieldOverrides: [
          { resourceCode: 'system.users.detail', fieldPath: 'salary', visibility: 'HIDDEN' },
        ],
      },
      {
        id: 'ag-2',
        companyId: TEST_COMPANY_ID,
        code: 'READ_ONLY',
        name: 'Read Only',
        description: 'View-only access',
        isSystem: true,
        isActive: true,
        createdBy: TEST_USER_ID,
        updatedBy: TEST_USER_ID,
        permissions: [
          {
            resourceCode: 'system.users.list',
            canAccess: true,
            canNew: false,
            canView: true,
            canEdit: false,
            canDelete: false,
          },
        ],
        fieldOverrides: [],
      },
    ];

    it('returns 200 with exported access groups, permissions, and field overrides (AC #1)', async () => {
      setupMocks();
      mockPrisma.accessGroup.findMany.mockResolvedValue(sampleGroups);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/company-profile/export-defaults',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.version).toBe('1.0.0');
      expect(body.data.exportedAt).toBeDefined();
      expect(body.data.exportedFrom).toBe('Acme Ltd');
      expect(body.data.accessGroups).toHaveLength(2);
      expect(body.data.accessGroups[0].code).toBe('FULL_ACCESS');
      expect(body.data.accessGroups[0].permissions).toHaveLength(1);
      expect(body.data.accessGroups[0].fieldOverrides).toHaveLength(1);
      expect(body.data.accessGroups[0].fieldOverrides[0].visibility).toBe('HIDDEN');
      expect(body.data.accessGroups[1].code).toBe('READ_ONLY');
      expect(body.data.accessGroups[1].fieldOverrides).toHaveLength(0);

      // Verify Content-Disposition header
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="company-defaults-\d{4}-\d{2}-\d{2}\.json"$/,
      );
    });

    it('queries only active access groups and returns empty array when none exist', async () => {
      setupMocks();
      mockPrisma.accessGroup.findMany.mockResolvedValue([]);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/company-profile/export-defaults',
        headers: authHeaders(testJwt),
      });

      expect(mockPrisma.accessGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: TEST_COMPANY_ID, isActive: true },
        }),
      );

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.accessGroups).toEqual([]);
    });

    it('returns 403 for STAFF role (AC #7)', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/system/company-profile/export-defaults',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // POST /system/company-profile/import-defaults
  // =========================================================================

  describe('POST /system/company-profile/import-defaults', () => {
    const validImportPayload = {
      version: '1.0.0',
      dryRun: false,
      accessGroups: [
        {
          code: 'SALES_STAFF',
          name: 'Sales Staff',
          description: 'Sales team access',
          permissions: [
            {
              resourceCode: 'sales.orders.list',
              canAccess: true,
              canNew: true,
              canView: true,
              canEdit: true,
              canDelete: false,
            },
          ],
          fieldOverrides: [
            { resourceCode: 'sales.orders.detail', fieldPath: 'costPrice', visibility: 'HIDDEN' },
          ],
        },
      ],
    };

    function setupImportMocks(existing: { id: string; isSystem: boolean } | null = null) {
      const groupId = existing?.id ?? 'new-group-id';
      mockPrisma.accessGroup.findUnique.mockResolvedValue(existing);
      mockPrisma.accessGroup.upsert.mockResolvedValue({
        id: groupId,
        companyId: TEST_COMPANY_ID,
        code: 'SALES_STAFF',
        name: 'Sales Staff',
      });
      mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.accessGroupPermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.accessGroupFieldOverride.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.accessGroupFieldOverride.createMany.mockResolvedValue({ count: 1 });
    }

    it('creates new access groups and returns counts (AC #2)', async () => {
      setupMocks();
      setupImportMocks(null); // No existing group

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: validImportPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('APPLIED');
      expect(body.data.summary.accessGroupsCreated).toBe(1);
      expect(body.data.summary.accessGroupsUpdated).toBe(0);
      expect(body.data.summary.permissionsSet).toBe(1);
      expect(body.data.summary.fieldOverridesSet).toBe(1);
    });

    it('updates existing access groups matched by code (AC #2, #4)', async () => {
      setupMocks();
      setupImportMocks({ id: 'existing-ag-id', isSystem: true });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: validImportPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.summary.accessGroupsCreated).toBe(0);
      expect(body.data.summary.accessGroupsUpdated).toBe(1);

      // Verify upsert does NOT update isSystem
      const upsertCall = mockPrisma.accessGroup.upsert.mock.calls[0]![0];
      expect(upsertCall.update).not.toHaveProperty('isSystem');
    });

    it('handles multiple access groups with mix of new and existing', async () => {
      setupMocks();
      // First group exists, second is new
      mockPrisma.accessGroup.findUnique
        .mockResolvedValueOnce({ id: 'existing-ag', isSystem: true })
        .mockResolvedValueOnce(null);
      mockPrisma.accessGroup.upsert
        .mockResolvedValueOnce({
          id: 'existing-ag',
          companyId: TEST_COMPANY_ID,
          code: 'SALES',
          name: 'Sales',
        })
        .mockResolvedValueOnce({
          id: 'new-ag',
          companyId: TEST_COMPANY_ID,
          code: 'WAREHOUSE',
          name: 'Warehouse',
        });
      mockPrisma.accessGroupPermission.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.accessGroupPermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.accessGroupFieldOverride.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.accessGroupFieldOverride.createMany.mockResolvedValue({ count: 0 });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: {
          accessGroups: [
            {
              code: 'SALES',
              name: 'Sales',
              permissions: [
                {
                  resourceCode: 'sales.orders.list',
                  canAccess: true,
                  canNew: true,
                  canView: true,
                  canEdit: true,
                  canDelete: false,
                },
              ],
              fieldOverrides: [],
            },
            {
              code: 'WAREHOUSE',
              name: 'Warehouse',
              permissions: [
                {
                  resourceCode: 'inventory.items.list',
                  canAccess: true,
                  canNew: false,
                  canView: true,
                  canEdit: false,
                  canDelete: false,
                },
              ],
              fieldOverrides: [],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe('APPLIED');
      expect(body.data.summary.accessGroupsCreated).toBe(1);
      expect(body.data.summary.accessGroupsUpdated).toBe(1);
      expect(body.data.summary.permissionsSet).toBe(2);
    });

    it('returns DRY_RUN status without modifying database when dryRun is true (AC #3)', async () => {
      setupMocks();
      // For dryRun, the transaction should throw DryRunAbort and catch it
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          try {
            return await fn(mockPrisma);
          } catch (err: unknown) {
            // Re-throw to let the service's .catch handler process it
            throw err;
          }
        },
      );
      setupImportMocks(null);

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: { ...validImportPayload, dryRun: true },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe('DRY_RUN');
      expect(body.data.summary.accessGroupsCreated).toBe(1);

      // Event should NOT be emitted for dryRun
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('returns DRY_RUN with updated counts when group already exists (AC #3, #4)', async () => {
      setupMocks();
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          try {
            return await fn(mockPrisma);
          } catch (err: unknown) {
            throw err;
          }
        },
      );
      setupImportMocks({ id: 'existing-ag-id', isSystem: true });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: { ...validImportPayload, dryRun: true },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe('DRY_RUN');
      expect(body.data.summary.accessGroupsUpdated).toBe(1);
      expect(body.data.summary.accessGroupsCreated).toBe(0);
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('emits company.defaultData.imported event after successful import (AC #5)', async () => {
      setupMocks();
      setupImportMocks(null);

      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: validImportPayload,
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('company.defaultData.imported', {
        companyId: TEST_COMPANY_ID,
        importedBy: TEST_USER_ID,
        version: '1.0.0',
      });
    });

    it('returns 400 for invalid payload (AC #6)', async () => {
      setupMocks();

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: { accessGroups: [] }, // min(1) violated
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for missing accessGroups field (AC #6)', async () => {
      setupMocks();

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: { version: '1.0.0' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 403 for STAFF role (AC #7)', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/system/company-profile/import-defaults',
        headers: authHeaders(testJwt),
        payload: validImportPayload,
      });

      expect(res.statusCode).toBe(403);
    });
  });
});

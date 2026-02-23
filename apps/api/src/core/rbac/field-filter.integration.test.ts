import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockLoadDefaultAccessGroups, mockAssignFullAccessGroup, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
  },
  mockResolveUserRole: vi.fn(),
  mockLoadDefaultAccessGroups: vi.fn().mockResolvedValue({ created: 0, updated: 0 }),
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
}));

vi.mock('./permission.service.js', () => ({
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

import { jwtVerifyPlugin } from '../auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../middleware/company-context.js';
import { registerErrorHandler } from '../middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../validation/index.js';
import { companyProfileRoutesPlugin } from '../../modules/system/company-profile.routes.js';
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

const now = new Date();

function sampleCompanyProfile() {
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
    addressLine1: '123 High Street',
    addressLine2: null,
    city: 'London',
    county: 'Greater London',
    postcode: 'EC1A 1BB',
    countryCode: 'GB',
    phone: '+44 20 7946 0958',
    email: 'info@acme.co.uk',
    website: null,
    timezone: 'Europe/London',
    weekStart: 1,
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    vatScheme: 'STANDARD',
    defaultLanguage: 'en',
    taxAgentName: null,
    taxAgentPhone: null,
    taxAgentEmail: null,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
  };
}

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

function setupMocks(config: {
  role?: string;
  fieldOverrides?: Record<string, Record<string, string>>;
} = {}) {
  const resolvedRole = config.role ?? 'ADMIN';
  const fieldOverrides = config.fieldOverrides ?? {};

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue(sampleCompanyProfile());
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const fullPerm = { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true };

  if (resolvedRole === 'SUPER_ADMIN') {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: resolvedRole,
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'system.company-profile.detail': fullPerm },
      fieldOverrides,
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system'],
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
// Integration Tests — Field-level visibility via onSend hook
// ---------------------------------------------------------------------------

describe('Field-filter integration (onSend hook on real routes)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC1+AC7 — HIDDEN field stripped via route onSend hook
  it('strips HIDDEN field from GET /system/company-profile response (AC1, AC7)', async () => {
    setupMocks({
      fieldOverrides: {
        'system.company-profile.detail': { vatNumber: 'HIDDEN' },
      },
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
    // vatNumber should be completely absent (HIDDEN)
    expect(body.data.vatNumber).toBeUndefined();
    // Other fields remain
    expect(body.data.name).toBe('Acme Ltd');
    expect(body.data.registrationNumber).toBe('12345678');
  });

  // AC2+AC7 — READ_ONLY field present with _fieldMeta
  it('annotates READ_ONLY field with _fieldMeta on GET /system/company-profile (AC2, AC7)', async () => {
    setupMocks({
      fieldOverrides: {
        'system.company-profile.detail': { registrationNumber: 'READ_ONLY' },
      },
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
    // registrationNumber present (READ_ONLY, not stripped)
    expect(body.data.registrationNumber).toBe('12345678');
    // _fieldMeta at envelope level
    expect(body._fieldMeta).toEqual({ registrationNumber: 'readOnly' });
  });

  // AC5 — SUPER_ADMIN bypass
  it('SUPER_ADMIN sees all fields, no _fieldMeta (AC5)', async () => {
    setupMocks({ role: 'SUPER_ADMIN' });

    app = await buildTestApp();

    const superJwt = await makeTestJwt({ role: 'SUPER_ADMIN' });
    const res = await app.inject({
      method: 'GET',
      url: '/system/company-profile',
      headers: authHeaders(superJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    // All fields present
    expect(body.data.vatNumber).toBe('GB123456789');
    expect(body.data.registrationNumber).toBe('12345678');
    // No _fieldMeta
    expect(body._fieldMeta).toBeUndefined();
  });

  // AC8 — No field overrides → response unchanged
  it('returns response unchanged when no field overrides exist (AC8)', async () => {
    setupMocks({ fieldOverrides: {} });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/company-profile',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    // All fields present
    expect(body.data.vatNumber).toBe('GB123456789');
    expect(body.data.registrationNumber).toBe('12345678');
    // No _fieldMeta
    expect(body._fieldMeta).toBeUndefined();
  });
});

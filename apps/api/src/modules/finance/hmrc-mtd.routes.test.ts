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
    vatReturn: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
      constructor(v: number | string) {
        this.value = typeof v === 'string' ? parseFloat(v) : v;
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
// Mock HMRC MTD client — allows per-test control of submission results
// ---------------------------------------------------------------------------

const { mockSubmitVatReturn } = vi.hoisted(() => ({
  mockSubmitVatReturn: vi.fn(),
}));

vi.mock('./hmrc-mtd.client.js', () => ({
  submitVatReturn: mockSubmitVatReturn,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { hmrcMtdRoutesPlugin } from './hmrc-mtd.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_VAT_RETURN_ID = '22222222-2222-4000-a000-222222222222';

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
  await app.register(hmrcMtdRoutesPlugin, { prefix: '/finance' });

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
          ? {
              'finance.vatReturns': fullPerm,
            }
          : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );

  // Default: HMRC stub returns success
  mockSubmitVatReturn.mockResolvedValue({
    success: true,
    submissionId: 'HMRC-1234567890',
  });
}

/** Sample VAT return data matching the Prisma model shape */
function makeSampleVatReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_VAT_RETURN_ID,
    companyId: TEST_COMPANY_ID,
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    status: 'CALCULATED',
    box1: 1500,
    box2: 0,
    box3: 1500,
    box4: 300,
    box5: 1200,
    box6: 7500,
    box7: 1500,
    box8: 0,
    box9: 0,
    calculatedAt: new Date('2026-03-15T10:00:00Z'),
    submittedAt: null,
    submittedBy: null,
    hmrcSubmissionId: null,
    hmrcResponse: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: TEST_USER_ID,
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
// POST /finance/vat-returns/:id/submit — AC-1: HMRC MTD submission
// ---------------------------------------------------------------------------

describe('POST /finance/vat-returns/:id/submit', () => {
  it('AC-1: submits a CALCULATED VAT return to HMRC successfully', async () => {
    app = await buildTestApp();
    const vatReturn = makeSampleVatReturn();

    mockPrisma.vatReturn.findFirst.mockResolvedValue(vatReturn);

    const submittedReturn = makeSampleVatReturn({
      status: 'SUBMITTED',
      hmrcSubmissionId: 'HMRC-1234567890',
      hmrcResponse: { success: true, submissionId: 'HMRC-1234567890' },
      submittedAt: new Date(),
      submittedBy: TEST_USER_ID,
    });
    mockPrisma.vatReturn.update.mockResolvedValue(submittedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('SUBMITTED');
    expect(body.data.hmrcSubmissionId).toBe('HMRC-1234567890');
    expect(body.data.submittedBy).toBe(TEST_USER_ID);
    expect(body.data.submittedAt).toBeTruthy();
  });

  it('AC-1: calls HMRC client with correct VAT return data', async () => {
    app = await buildTestApp();
    const vatReturn = makeSampleVatReturn();

    mockPrisma.vatReturn.findFirst.mockResolvedValue(vatReturn);
    mockPrisma.vatReturn.update.mockResolvedValue(makeSampleVatReturn({ status: 'SUBMITTED' }));

    await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockSubmitVatReturn).toHaveBeenCalledOnce();
    expect(mockSubmitVatReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        box1: 1500,
        box3: 1500,
        box4: 300,
        box5: 1200,
        box6: 7500,
        box7: 1500,
      }),
    );
  });

  it('AC-2: rejects submission when status is DRAFT', async () => {
    app = await buildTestApp();
    const draftReturn = makeSampleVatReturn({ status: 'DRAFT' });

    mockPrisma.vatReturn.findFirst.mockResolvedValue(draftReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_STATUS');
    expect(mockSubmitVatReturn).not.toHaveBeenCalled();
  });

  it('AC-2: rejects submission when status is SUBMITTED', async () => {
    app = await buildTestApp();
    const submittedReturn = makeSampleVatReturn({ status: 'SUBMITTED' });

    mockPrisma.vatReturn.findFirst.mockResolvedValue(submittedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    expect(mockSubmitVatReturn).not.toHaveBeenCalled();
  });

  it('AC-2: rejects submission when status is ACCEPTED', async () => {
    app = await buildTestApp();
    const acceptedReturn = makeSampleVatReturn({ status: 'ACCEPTED' });

    mockPrisma.vatReturn.findFirst.mockResolvedValue(acceptedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    expect(mockSubmitVatReturn).not.toHaveBeenCalled();
  });

  it('AC-3: stores hmrcSubmissionId and hmrcResponse on success', async () => {
    app = await buildTestApp();
    const vatReturn = makeSampleVatReturn();

    mockPrisma.vatReturn.findFirst.mockResolvedValue(vatReturn);
    mockPrisma.vatReturn.update.mockResolvedValue(
      makeSampleVatReturn({
        status: 'SUBMITTED',
        hmrcSubmissionId: 'HMRC-1234567890',
        hmrcResponse: { success: true, submissionId: 'HMRC-1234567890' },
      }),
    );

    await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.vatReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_VAT_RETURN_ID },
        data: expect.objectContaining({
          status: 'SUBMITTED',
          hmrcSubmissionId: 'HMRC-1234567890',
          hmrcResponse: { success: true, submissionId: 'HMRC-1234567890' },
          submittedBy: TEST_USER_ID,
        }),
      }),
    );
  });

  it('AC-4: updates status to REJECTED when HMRC returns failure', async () => {
    app = await buildTestApp();
    const vatReturn = makeSampleVatReturn();

    mockPrisma.vatReturn.findFirst.mockResolvedValue(vatReturn);

    // HMRC returns failure
    mockSubmitVatReturn.mockResolvedValue({
      success: false,
      error: 'INVALID_VRN: VAT registration number not found',
    });

    const rejectedReturn = makeSampleVatReturn({
      status: 'REJECTED',
      hmrcResponse: { success: false, error: 'INVALID_VRN: VAT registration number not found' },
    });
    mockPrisma.vatReturn.update.mockResolvedValue(rejectedReturn);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('REJECTED');

    expect(mockPrisma.vatReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          hmrcResponse: {
            success: false,
            error: 'INVALID_VRN: VAT registration number not found',
          },
        }),
      }),
    );
  });

  it('returns 404 for non-existent VAT return', async () => {
    app = await buildTestApp();
    mockPrisma.vatReturn.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockSubmitVatReturn).not.toHaveBeenCalled();
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/vat-returns/${TEST_VAT_RETURN_ID}/submit`,
    });

    expect(res.statusCode).toBe(401);
    expect(mockSubmitVatReturn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Stub HMRC client unit tests
// ---------------------------------------------------------------------------

describe('HMRC MTD client stub', () => {
  it('returns success with a submission ID', async () => {
    // Import the real (non-mocked) client for direct testing
    // We test via the route above, but also verify the stub interface
    const { submitVatReturn: realSubmit } =
      await vi.importActual<typeof import('./hmrc-mtd.client.js')>('./hmrc-mtd.client.js');

    const result = await realSubmit({
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-03-31'),
      box1: 1500,
      box2: 0,
      box3: 1500,
      box4: 300,
      box5: 1200,
      box6: 7500,
      box7: 1500,
      box8: 0,
      box9: 0,
    });

    expect(result.success).toBe(true);
    expect(result.submissionId).toBeDefined();
    expect(result.submissionId).toMatch(/^HMRC-\d+$/);
    expect(result.error).toBeUndefined();
  });
});

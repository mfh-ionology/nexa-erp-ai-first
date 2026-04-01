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
    bankReconciliationRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    bankAccount: {
      findFirst: vi.fn(),
    },
    bankTransaction: {
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
  Prisma: {
    Decimal: class Decimal {
      private value: string;
      constructor(v: string | number) {
        this.value = String(v);
      }
      toString() {
        return this.value;
      }
      toNumber() {
        return Number(this.value);
      }
    },
  },
  resolveUserRole: mockResolveUserRole,
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
import { bankReconRulesRoutesPlugin } from './bank-recon-rules.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_RULE_ID = '22222222-2222-4000-a000-222222222222';
const TEST_BANK_ACCOUNT_ID = '33333333-3333-4000-a000-333333333333';

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
  await app.register(bankReconRulesRoutesPlugin, { prefix: '/finance' });

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
        permissions: hasAccess ? { 'finance.bankAccounts': fullPerm } : {},
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: hasAccess ? ['FINANCE'] : [],
      };
    },
  );
}

const NOW = new Date('2026-03-31T12:00:00Z');

const SAMPLE_RULE = {
  id: TEST_RULE_ID,
  companyId: TEST_COMPANY_ID,
  name: 'Rent Payment',
  matchType: 'STARTS_WITH',
  matchPattern: 'DIRECT DEBIT - LANDLORD',
  targetAccountCode: '6000',
  description: 'Monthly rent',
  vatCode: null,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  createdBy: TEST_USER_ID,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

beforeEach(async () => {
  vi.clearAllMocks();
  setupMocks();
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe('GET /finance/bank-recon-rules', () => {
  it('returns paginated list of rules', async () => {
    mockPrisma.bankReconciliationRule.findMany.mockResolvedValue([SAMPLE_RULE]);
    mockPrisma.bankReconciliationRule.count.mockResolvedValue(1);

    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/finance/bank-recon-rules',
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Rent Payment');
  });
});

describe('POST /finance/bank-recon-rules', () => {
  it('creates a new rule', async () => {
    mockPrisma.bankReconciliationRule.create.mockResolvedValue(SAMPLE_RULE);

    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-recon-rules',
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Rent Payment',
        matchType: 'STARTS_WITH',
        matchPattern: 'DIRECT DEBIT - LANDLORD',
        targetAccountCode: '6000',
        description: 'Monthly rent',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Rent Payment');
  });

  it('rejects invalid matchType', async () => {
    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-recon-rules',
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Test',
        matchType: 'INVALID',
        matchPattern: 'test',
        targetAccountCode: '6000',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /finance/bank-recon-rules/:id', () => {
  it('updates an existing rule', async () => {
    mockPrisma.bankReconciliationRule.findFirst.mockResolvedValue(SAMPLE_RULE);
    mockPrisma.bankReconciliationRule.update.mockResolvedValue({
      ...SAMPLE_RULE,
      name: 'Updated Rent',
    });

    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'PATCH',
      url: `/finance/bank-recon-rules/${TEST_RULE_ID}`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
        'content-type': 'application/json',
      },
      payload: { name: 'Updated Rent' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.name).toBe('Updated Rent');
  });
});

describe('DELETE /finance/bank-recon-rules/:id', () => {
  it('deletes a rule', async () => {
    mockPrisma.bankReconciliationRule.findFirst.mockResolvedValue(SAMPLE_RULE);
    mockPrisma.bankReconciliationRule.delete.mockResolvedValue(SAMPLE_RULE);

    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'DELETE',
      url: `/finance/bank-recon-rules/${TEST_RULE_ID}`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });
});

describe('POST /finance/bank-accounts/:id/apply-rules', () => {
  it('returns suggestions when rules match transactions', async () => {
    mockPrisma.bankReconciliationRule.findMany.mockResolvedValue([SAMPLE_RULE]);
    mockPrisma.bankTransaction.findMany.mockResolvedValue([
      {
        id: '44444444-4444-4000-a000-444444444444',
        description: 'DIRECT DEBIT - LANDLORD ACME LTD',
      },
      {
        id: '55555555-5555-4000-a000-555555555555',
        description: 'ATM WITHDRAWAL',
      },
    ]);

    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/apply-rules`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].bankTransactionId).toBe('44444444-4444-4000-a000-444444444444');
    expect(body.data[0].suggestedAccountCode).toBe('6000');
  });

  it('returns empty array when no rules exist', async () => {
    mockPrisma.bankReconciliationRule.findMany.mockResolvedValue([]);

    const token = await makeTestJwt();
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/apply-rules`,
      headers: {
        authorization: `Bearer ${token}`,
        'x-company-id': TEST_COMPANY_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveLength(0);
  });
});

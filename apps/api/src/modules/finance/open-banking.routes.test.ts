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
    bankAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    bankTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
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
    Decimal: class MockDecimal {
      private value: string;
      constructor(val: string | number) {
        this.value = String(val);
      }
      toString() {
        return this.value;
      }
      toNumber() {
        return parseFloat(this.value);
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

// Mock the Open Banking client
const { mockConnectAccount, mockSyncTransactions, mockDisconnectAccount } = vi.hoisted(() => ({
  mockConnectAccount: vi.fn(),
  mockSyncTransactions: vi.fn(),
  mockDisconnectAccount: vi.fn(),
}));

vi.mock('./open-banking.client.js', () => ({
  connectAccount: mockConnectAccount,
  syncTransactions: mockSyncTransactions,
  disconnectAccount: mockDisconnectAccount,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { openBankingRoutesPlugin } from './open-banking.routes.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_BANK_ACCOUNT_ID = '22222222-2222-4000-a000-222222222222';

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
  await app.register(openBankingRoutesPlugin, { prefix: '/finance' });

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
          ? { 'finance.bankAccounts': fullPerm, 'finance.accounts': fullPerm }
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
// POST /finance/bank-accounts/:id/open-banking/connect — AC-1
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:id/open-banking/connect', () => {
  it('connects a bank account to Open Banking provider (AC-1)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'DISCONNECTED',
      openBankingConnId: null,
    });

    mockConnectAccount.mockResolvedValue({
      connectionId: 'OB-truelayer-123456',
      provider: 'truelayer',
      status: 'CONNECTED',
    });

    mockPrisma.bankAccount.update.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'truelayer' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.connectionId).toBe('OB-truelayer-123456');
    expect(body.data.provider).toBe('truelayer');
    expect(body.data.status).toBe('CONNECTED');
  });

  it('updates BankAccount openBankingStatus and openBankingProvider on connect (AC-4)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'DISCONNECTED',
      openBankingConnId: null,
    });

    mockConnectAccount.mockResolvedValue({
      connectionId: 'OB-plaid-789',
      provider: 'plaid',
      status: 'CONNECTED',
    });

    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'plaid' },
    });

    expect(mockPrisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: TEST_BANK_ACCOUNT_ID },
      data: {
        openBankingStatus: 'CONNECTED',
        openBankingProvider: 'plaid',
        openBankingConnId: 'OB-plaid-789',
        updatedBy: TEST_USER_ID,
      },
    });
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'truelayer' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 if bank account is already connected', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-existing',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'truelayer' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ALREADY_CONNECTED');
  });

  it('returns 400 for missing provider', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid bank account ID (not a UUID)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts/not-a-uuid/open-banking/connect',
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'truelayer' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: { 'content-type': 'application/json' },
      payload: { provider: 'truelayer' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${viewerJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'truelayer' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('scopes bank account lookup to the company', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'DISCONNECTED',
      openBankingConnId: null,
    });

    mockConnectAccount.mockResolvedValue({
      connectionId: 'OB-test-1',
      provider: 'test',
      status: 'CONNECTED',
    });

    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/connect`,
      headers: {
        authorization: `Bearer ${testJwt}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'test' },
    });

    expect(mockPrisma.bankAccount.findFirst).toHaveBeenCalledWith({
      where: { id: TEST_BANK_ACCOUNT_ID, companyId: TEST_COMPANY_ID },
      select: { id: true, openBankingStatus: true, openBankingConnId: true },
    });
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/open-banking/sync — AC-2
// No request body — do NOT set content-type: application/json
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:id/open-banking/sync', () => {
  it('syncs transactions from Open Banking (AC-2)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-truelayer-123',
    });

    mockSyncTransactions.mockResolvedValue([]);
    mockPrisma.bankAccount.update.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(0);
    expect(body.data.imported).toBe(0);
    expect(body.data.duplicatesSkipped).toBe(0);
    expect(body.data.syncedAt).toBeTruthy();
  });

  it('updates openBankingLastSync after sync (AC-4)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-truelayer-123',
    });

    mockSyncTransactions.mockResolvedValue([]);
    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_BANK_ACCOUNT_ID },
        data: expect.objectContaining({
          openBankingLastSync: expect.any(Date),
          updatedBy: TEST_USER_ID,
        }),
      }),
    );
  });

  it('creates BankTransaction records with duplicate detection when transactions returned (AC-5)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-truelayer-123',
    });

    mockSyncTransactions.mockResolvedValue([
      {
        externalId: 'OB-TXN-001',
        date: '2026-01-15',
        description: 'ACME PAYMENT',
        amount: 1500.0,
        reference: 'REF001',
      },
      {
        externalId: 'OB-TXN-002',
        date: '2026-01-16',
        description: 'ELECTRIC BILL',
        amount: -250.0,
      },
    ]);

    // One transaction already exists (duplicate)
    mockPrisma.bankTransaction.findMany.mockResolvedValue([{ externalId: 'OB-TXN-001' }]);

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.bankTransaction.create.mockResolvedValue({});
    mockPrisma.bankAccount.update.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.total).toBe(2);
    expect(body.data.imported).toBe(1);
    expect(body.data.duplicatesSkipped).toBe(1);

    // Verify only the new transaction was created
    expect(mockPrisma.bankTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.bankTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          bankAccountId: TEST_BANK_ACCOUNT_ID,
          externalId: 'OB-TXN-002',
          description: 'ELECTRIC BILL',
          type: 'DEBIT',
          isMatched: false,
        }),
      }),
    );
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 if bank account is not connected', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'DISCONNECTED',
      openBankingConnId: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('NOT_CONNECTED');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('scopes bank account lookup to the company', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-test-1',
    });

    mockSyncTransactions.mockResolvedValue([]);
    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/sync`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findFirst).toHaveBeenCalledWith({
      where: { id: TEST_BANK_ACCOUNT_ID, companyId: TEST_COMPANY_ID },
      select: { id: true, openBankingStatus: true, openBankingConnId: true },
    });
  });
});

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/open-banking/disconnect — AC-3
// No request body — do NOT set content-type: application/json
// ---------------------------------------------------------------------------

describe('POST /finance/bank-accounts/:id/open-banking/disconnect', () => {
  it('disconnects a bank account from Open Banking (AC-3)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-truelayer-123',
    });

    mockDisconnectAccount.mockResolvedValue({ success: true });
    mockPrisma.bankAccount.update.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.disconnected).toBe(true);
  });

  it('resets Open Banking fields on disconnect (AC-4)', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-truelayer-123',
    });

    mockDisconnectAccount.mockResolvedValue({ success: true });
    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: TEST_BANK_ACCOUNT_ID },
      data: {
        openBankingStatus: 'DISCONNECTED',
        openBankingProvider: null,
        openBankingConnId: null,
        openBankingLastSync: null,
        updatedBy: TEST_USER_ID,
      },
    });
  });

  it('calls disconnectAccount on the provider client', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-truelayer-999',
    });

    mockDisconnectAccount.mockResolvedValue({ success: true });
    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockDisconnectAccount).toHaveBeenCalledWith('OB-truelayer-999');
  });

  it('returns 404 for non-existent bank account', async () => {
    app = await buildTestApp();
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 if bank account is already disconnected', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'DISCONNECTED',
      openBankingConnId: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ALREADY_DISCONNECTED');
  });

  it('returns 401 without auth token', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
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
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${viewerJwt}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 400 for invalid bank account ID (not a UUID)', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/finance/bank-accounts/not-a-uuid/open-banking/disconnect',
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('scopes bank account lookup to the company', async () => {
    app = await buildTestApp();

    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      openBankingStatus: 'CONNECTED',
      openBankingConnId: 'OB-test-1',
    });

    mockDisconnectAccount.mockResolvedValue({ success: true });
    mockPrisma.bankAccount.update.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${TEST_BANK_ACCOUNT_ID}/open-banking/disconnect`,
      headers: { authorization: `Bearer ${testJwt}` },
    });

    expect(mockPrisma.bankAccount.findFirst).toHaveBeenCalledWith({
      where: { id: TEST_BANK_ACCOUNT_ID, companyId: TEST_COMPANY_ID },
      select: { id: true, openBankingStatus: true, openBankingConnId: true },
    });
  });
});

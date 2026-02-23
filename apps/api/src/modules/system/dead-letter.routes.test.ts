import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
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
import { deadLetterRoutesPlugin } from './dead-letter.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Mock deadLetterService & eventBus
// ---------------------------------------------------------------------------

const mockDeadLetterService = {
  list: vi.fn(),
  getById: vi.fn(),
  markReprocessed: vi.fn(),
  add: vi.fn(),
  close: vi.fn(),
};

const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  drain: vi.fn().mockResolvedValue(undefined),
  removeAllListeners: vi.fn(),
  setLogger: vi.fn(),
  setRetryExecutor: vi.fn(),
  setDeadLetterService: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function sampleDlqEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dlq-001',
    eventName: 'invoice.posted',
    payload: { invoiceId: 'inv-1', invoiceNumber: 'INV-001', customerId: 'cust-1', totalAmount: '100.00', journalEntryId: 'je-1', periodId: 'p-1' },
    error: 'Database connection lost',
    stack: 'Error: Database connection lost\n    at handler (/app/handler.ts:10:5)',
    retryCount: 3,
    originalTimestamp: '2026-02-20T10:00:00.000Z',
    createdAt: '2026-02-20T10:00:07.000Z',
    reprocessed: false,
    reprocessedAt: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate with mock services (mimics event-bus + dead-letter plugins)
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);
  app.decorate('deadLetterService', mockDeadLetterService as unknown as FastifyInstance['deadLetterService']);

  await app.register(deadLetterRoutesPlugin, { prefix: '/system' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string; hasPermission?: boolean } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';
  const hasPermission = config.hasPermission ?? true;

  mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
    if (args.where.id === TEST_USER_ID) {
      return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
    }
    return Promise.resolve(null);
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  if (resolvedRole === 'SUPER_ADMIN') {
    const fullPerm = { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true };
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'system.dead-letter-queue.list': fullPerm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else if (hasPermission) {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {
        'system.dead-letter-queue.list': {
          canAccess: true,
          canNew: false,
          canView: true,
          canEdit: true,
          canDelete: false,
        },
      },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system'],
    });
  } else {
    // No permissions
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: {},
      fieldOverrides: {},
      accessGroups: [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: [],
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
// GET /system/dead-letter-queue — filtered, paginated DLQ entries
// ---------------------------------------------------------------------------

describe('GET /system/dead-letter-queue', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 14.2 — returns DLQ entries (AC #3)
  it('returns DLQ entries (AC #3)', async () => {
    setupMocks({ role: 'ADMIN' });
    const entries = [
      sampleDlqEntry({ id: 'dlq-001' }),
      sampleDlqEntry({ id: 'dlq-002', eventName: 'user.login' }),
    ];
    mockDeadLetterService.list.mockResolvedValue({
      items: entries,
      cursor: null,
      hasMore: false,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('dlq-001');
    expect(body.data[0].eventName).toBe('invoice.posted');
    expect(body.data[1].id).toBe('dlq-002');
    expect(body.data[1].eventName).toBe('user.login');

    expect(mockDeadLetterService.list).toHaveBeenCalledWith({
      eventName: undefined,
      reprocessed: undefined,
      cursor: undefined,
      limit: 20,
    });
  });

  // 14.3 — eventName filter returns only matching entries
  it('filters by eventName', async () => {
    setupMocks({ role: 'ADMIN' });
    const entries = [sampleDlqEntry({ id: 'dlq-003', eventName: 'invoice.posted' })];
    mockDeadLetterService.list.mockResolvedValue({
      items: entries,
      cursor: null,
      hasMore: false,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue?eventName=invoice.posted',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].eventName).toBe('invoice.posted');

    expect(mockDeadLetterService.list).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'invoice.posted' }),
    );
  });

  // 14.4 — reprocessed filter works
  it('filters by reprocessed status', async () => {
    setupMocks({ role: 'ADMIN' });
    const entries = [
      sampleDlqEntry({ id: 'dlq-004', reprocessed: true, reprocessedAt: '2026-02-21T09:00:00.000Z' }),
    ];
    mockDeadLetterService.list.mockResolvedValue({
      items: entries,
      cursor: null,
      hasMore: false,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue?reprocessed=true',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reprocessed).toBe(true);

    expect(mockDeadLetterService.list).toHaveBeenCalledWith(
      expect.objectContaining({ reprocessed: true }),
    );
  });

  // 14.5 — cursor pagination
  it('supports cursor pagination', async () => {
    setupMocks({ role: 'ADMIN' });

    // First page with hasMore
    const firstPageEntries = [
      sampleDlqEntry({ id: 'dlq-010' }),
      sampleDlqEntry({ id: 'dlq-011' }),
    ];
    mockDeadLetterService.list.mockResolvedValue({
      items: firstPageEntries,
      cursor: 'dlq-011',
      hasMore: true,
    });

    app = await buildTestApp();

    const firstRes = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue?limit=2',
      headers: authHeaders(testJwt),
    });

    expect(firstRes.statusCode).toBe(200);
    const firstBody = firstRes.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.meta.hasMore).toBe(true);
    expect(firstBody.meta.cursor).toBe('dlq-011');

    // Second page using cursor
    const secondPageEntries = [sampleDlqEntry({ id: 'dlq-012' })];
    mockDeadLetterService.list.mockResolvedValue({
      items: secondPageEntries,
      cursor: null,
      hasMore: false,
    });

    const secondRes = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue?limit=2&cursor=dlq-011',
      headers: authHeaders(testJwt),
    });

    expect(secondRes.statusCode).toBe(200);
    const secondBody = secondRes.json();
    expect(secondBody.success).toBe(true);
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.meta.hasMore).toBe(false);
    expect(secondBody.meta.cursor).toBeNull();

    expect(mockDeadLetterService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'dlq-011', limit: 2 }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /system/dead-letter-queue/:id/reprocess
// ---------------------------------------------------------------------------

describe('POST /system/dead-letter-queue/:id/reprocess', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 14.6 — re-emits event and marks as reprocessed (AC #4)
  it('re-emits event and marks as reprocessed (AC #4)', async () => {
    setupMocks({ role: 'ADMIN' });
    const entry = sampleDlqEntry({ id: 'dlq-100', reprocessed: false });
    mockDeadLetterService.getById.mockResolvedValue(entry);
    mockDeadLetterService.markReprocessed.mockResolvedValue(undefined);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/dead-letter-queue/dlq-100/reprocess',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('dlq-100');
    expect(body.data.reprocessed).toBe(true);

    // Verify event was re-emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      entry.eventName,
      entry.payload,
    );

    // Verify entry was marked as reprocessed
    expect(mockDeadLetterService.markReprocessed).toHaveBeenCalledWith('dlq-100');
  });

  // 14.7 — returns 404 for non-existent ID
  it('returns 404 for non-existent ID', async () => {
    setupMocks({ role: 'ADMIN' });
    mockDeadLetterService.getById.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/dead-letter-queue/non-existent/reprocess',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  // 14.8 — returns 409 for already-reprocessed entry
  it('returns 409 for already-reprocessed entry', async () => {
    setupMocks({ role: 'ADMIN' });
    const entry = sampleDlqEntry({
      id: 'dlq-200',
      reprocessed: true,
      reprocessedAt: '2026-02-21T08:00:00.000Z',
    });
    mockDeadLetterService.getById.mockResolvedValue(entry);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/dead-letter-queue/dlq-200/reprocess',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');

    // Should NOT have re-emitted or marked
    expect(mockEventBus.emit).not.toHaveBeenCalled();
    expect(mockDeadLetterService.markReprocessed).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated — 401
// ---------------------------------------------------------------------------

describe('Unauthenticated requests get 401', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 14.9 — unauthenticated request to GET /system/dead-letter-queue returns 401
  it('GET /system/dead-letter-queue — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // 14.9 — unauthenticated request to POST /system/dead-letter-queue/:id/reprocess returns 401
  it('POST /system/dead-letter-queue/:id/reprocess — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/dead-letter-queue/dlq-001/reprocess',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// RBAC — 403 for users without permission
// ---------------------------------------------------------------------------

describe('RBAC — user without system.dead-letter-queue.list permission gets 403', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // 14.10 — user without permission returns 403
  it('GET /system/dead-letter-queue — 403 for user without permission', async () => {
    setupMocks({ role: 'STAFF', hasPermission: false });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/system/dead-letter-queue',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('POST /system/dead-letter-queue/:id/reprocess — 403 for user without permission', async () => {
    setupMocks({ role: 'STAFF', hasPermission: false });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/system/dead-letter-queue/dlq-001/reprocess',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

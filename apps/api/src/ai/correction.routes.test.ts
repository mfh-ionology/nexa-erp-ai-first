// ---------------------------------------------------------------------------
// Route-level tests for Correction Review endpoints
// E5d-2 Task 8.8
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockArticleService } = vi.hoisted(
  () => ({
    mockPrisma: {
      user: { findUnique: vi.fn() },
      companyProfile: { findUnique: vi.fn() },
      aiCorrectionLog: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      $queryRaw: vi.fn(),
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
    mockArticleService: {
      createArticle: vi.fn(),
      listArticles: vi.fn(),
      getArticle: vi.fn(),
      updateArticle: vi.fn(),
      deleteArticle: vi.fn(),
    },
  }),
);

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

vi.mock('../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../core/middleware/company-context.js';
import { registerErrorHandler } from '../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../core/validation/index.js';
import { correctionRoutesPlugin } from './correction.routes.js';
import { makeTestJwt, authHeaders, TEST_JWT_SECRET, TEST_COMPANY_ID } from '../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(opts: { withArticleService?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  const service = opts.withArticleService !== false ? mockArticleService : null;
  app.decorate('aiKnowledgeArticleService', service as any);

  await app.register(correctionRoutesPlugin, { prefix: '/ai' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const aiChatPerm = {
    canAccess: true,
    canNew: true,
    canView: true,
    canEdit: true,
    canDelete: true,
  };

  mockPermissionService.getEffectivePermissions.mockResolvedValue({
    permissions: { 'ai.chat': aiChatPerm },
    fieldOverrides: {},
    accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
    role: resolvedRole,
    isSuperAdmin: resolvedRole === 'SUPER_ADMIN',
    enabledModules: ['system', 'ar', 'finance'],
  });
}

function makeCorrectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    companyId: TEST_COMPANY_ID,
    userId: randomUUID(),
    conversationId: null,
    messageId: null,
    skillKey: null,
    originalResponse: 'Original AI response',
    correctedResponse: 'Corrected response from user',
    correctionType: 'OTHER',
    wasAutoResolved: false,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let staffJwt: string;
let adminJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  staffJwt = await makeTestJwt({ role: 'STAFF' });
  adminJwt = await makeTestJwt({ role: 'ADMIN' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/corrections
// ---------------------------------------------------------------------------

describe('GET /ai/corrections', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('lists corrections and returns 200', async () => {
    setupMocks();
    const correction = makeCorrectionRow();
    mockPrisma.aiCorrectionLog.findMany.mockResolvedValue([correction]);
    mockPrisma.aiCorrectionLog.count.mockResolvedValue(1);
    mockPrisma.aiCorrectionLog.groupBy
      .mockResolvedValueOnce([{ correctionType: 'OTHER', _count: 1 }])
      .mockResolvedValueOnce([]);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/corrections',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.stats.total).toBe(1);
  });

  it('passes correctionType filter', async () => {
    setupMocks();
    mockPrisma.aiCorrectionLog.findMany.mockResolvedValue([]);
    mockPrisma.aiCorrectionLog.count.mockResolvedValue(0);
    mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([]);
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/corrections?correctionType=TERMINOLOGY',
      headers: authHeaders(adminJwt),
    });

    expect(mockPrisma.aiCorrectionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ correctionType: 'TERMINOLOGY' }),
      }),
    );
  });

  it('supports cursor-based pagination', async () => {
    setupMocks();
    const corrections = [makeCorrectionRow(), makeCorrectionRow()];
    // Return limit+1 to indicate there's more
    mockPrisma.aiCorrectionLog.findMany.mockResolvedValue(corrections);
    mockPrisma.aiCorrectionLog.count.mockResolvedValue(5);
    mockPrisma.aiCorrectionLog.groupBy.mockResolvedValue([]);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/corrections?limit=1',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.hasMore).toBe(true);
  });

  it('rejects STAFF role (ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/corrections',
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(403);
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/corrections',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/corrections/stats
// ---------------------------------------------------------------------------

describe('GET /ai/corrections/stats', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns aggregated stats', async () => {
    setupMocks();
    mockPrisma.aiCorrectionLog.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(5) // totalLast30Days
      .mockResolvedValueOnce(2); // autoResolvedCount
    mockPrisma.aiCorrectionLog.groupBy
      .mockResolvedValueOnce([{ correctionType: 'TERMINOLOGY', _count: 4 }]) // byType
      .mockResolvedValueOnce([{ skillKey: 'create_invoice', _count: 3 }]); // bySkill
    mockPrisma.$queryRaw.mockResolvedValue([{ day: '2026-03-01', count: BigInt(3) }]);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/corrections/stats',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(10);
    expect(body.data.totalLast30Days).toBe(5);
    expect(body.data.autoResolvedCount).toBe(2);
    expect(body.data.byType).toHaveProperty('TERMINOLOGY');
    expect(body.data.trend).toHaveLength(1);
  });

  it('rejects STAFF role (ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/corrections/stats',
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /ai/corrections/:correctionId/create-article
// ---------------------------------------------------------------------------

describe('POST /ai/corrections/:correctionId/create-article', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates a knowledge article from correction (201)', async () => {
    setupMocks();
    const correctionId = randomUUID();
    const correction = makeCorrectionRow({
      id: correctionId,
      correctedResponse: 'The correct VAT code is 3 for EU purchases.',
      correctionType: 'TERMINOLOGY',
    });
    mockPrisma.aiCorrectionLog.findFirst.mockResolvedValue(correction);
    mockArticleService.createArticle.mockResolvedValue({
      id: randomUUID(),
      companyId: TEST_COMPANY_ID,
      title: `From correction: The correct VAT code is 3 for EU purchases.`,
      content: 'The correct VAT code is 3 for EU purchases.',
      category: 'TERMINOLOGY',
      source: 'CORRECTION_DERIVED',
      sourceRef: correctionId,
      confidenceScore: 0.8,
      isConfirmed: false,
      usageCount: 0,
      lastUsedAt: null,
      isActive: true,
      createdById: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      chunkCount: 1,
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/ai/corrections/${correctionId}/create-article`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.source).toBe('CORRECTION_DERIVED');
  });

  it('returns 404 for non-existent correction', async () => {
    setupMocks();
    mockPrisma.aiCorrectionLog.findFirst.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/ai/corrections/${randomUUID()}/create-article`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('enforces companyId isolation (cross-tenant → 404)', async () => {
    setupMocks();
    // Correction exists but for different company → findFirst returns null due to companyId filter
    mockPrisma.aiCorrectionLog.findFirst.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/ai/corrections/${randomUUID()}/create-article`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
    expect(mockPrisma.aiCorrectionLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
      }),
    );
  });

  it('returns 503 when knowledge article service is unavailable', async () => {
    setupMocks();
    app = await buildTestApp({ withArticleService: false });

    const res = await app.inject({
      method: 'POST',
      url: `/ai/corrections/${randomUUID()}/create-article`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(503);
  });

  it('rejects STAFF role (ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/ai/corrections/${randomUUID()}/create-article`,
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(403);
  });

  it('validates correctionId is UUID', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/corrections/not-a-uuid/create-article',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(400);
  });
});

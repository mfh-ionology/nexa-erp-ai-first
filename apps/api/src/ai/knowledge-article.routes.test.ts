// ---------------------------------------------------------------------------
// Route-level tests for Knowledge Article CRUD endpoints
// E5d-1 Task 7.4
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
import { knowledgeArticleRoutesPlugin } from './knowledge-article.routes.js';
import { makeTestJwt, authHeaders, TEST_JWT_SECRET, TEST_COMPANY_ID } from '../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(opts: { withService?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  const service = opts.withService !== false ? mockArticleService : null;
  app.decorate('aiKnowledgeArticleService', service as any);

  await app.register(knowledgeArticleRoutesPlugin, { prefix: '/ai' });
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

function makeArticleResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    companyId: TEST_COMPANY_ID,
    title: 'VAT Code Reference',
    content: 'VAT code 3 means reverse charge for EU purchases.',
    category: 'TERMINOLOGY',
    source: 'ADMIN_UPLOADED',
    sourceRef: null,
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 0,
    lastUsedAt: null,
    isActive: true,
    createdById: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    chunkCount: 2,
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
// Tests: GET /ai/knowledge-articles
// ---------------------------------------------------------------------------

describe('GET /ai/knowledge-articles', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('lists articles and returns 200', async () => {
    setupMocks();
    mockArticleService.listArticles.mockResolvedValue({
      data: [makeArticleResponse()],
      nextCursor: null,
      total: 1,
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/knowledge-articles',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ cursor: null, hasMore: false, total: 1 });
  });

  it('passes category filter to service', async () => {
    setupMocks();
    mockArticleService.listArticles.mockResolvedValue({ data: [], nextCursor: null, total: 0 });
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/knowledge-articles?category=TERMINOLOGY',
      headers: authHeaders(adminJwt),
    });

    expect(mockArticleService.listArticles).toHaveBeenCalledWith(
      TEST_COMPANY_ID,
      expect.objectContaining({ category: 'TERMINOLOGY' }),
    );
  });

  it('passes isActive filter to service', async () => {
    setupMocks();
    mockArticleService.listArticles.mockResolvedValue({ data: [], nextCursor: null, total: 0 });
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/knowledge-articles?isActive=true',
      headers: authHeaders(adminJwt),
    });

    expect(mockArticleService.listArticles).toHaveBeenCalledWith(
      TEST_COMPANY_ID,
      expect.objectContaining({ isActive: true }),
    );
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/knowledge-articles',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when service is unavailable', async () => {
    setupMocks();
    app = await buildTestApp({ withService: false });

    const res = await app.inject({
      method: 'GET',
      url: '/ai/knowledge-articles',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /ai/knowledge-articles
// ---------------------------------------------------------------------------

describe('POST /ai/knowledge-articles', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates an article and returns 201 (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    const articleResp = makeArticleResponse();
    mockArticleService.createArticle.mockResolvedValue(articleResp);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/knowledge-articles',
      headers: authHeaders(adminJwt),
      payload: {
        title: 'VAT Code Reference',
        content: 'VAT code 3 means reverse charge for EU purchases.',
        category: 'TERMINOLOGY',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('VAT Code Reference');
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/knowledge-articles',
      headers: authHeaders(staffJwt),
      payload: {
        title: 'Test',
        content: 'Test content.',
        category: 'TERMINOLOGY',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects invalid category with 400', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/knowledge-articles',
      headers: authHeaders(adminJwt),
      payload: {
        title: 'Test',
        content: 'Test content.',
        category: 'INVALID_CATEGORY',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/knowledge-articles',
      headers: authHeaders(adminJwt),
      payload: { title: 'Only title' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('ignores source field in REST body — always creates as ADMIN_UPLOADED', async () => {
    setupMocks({ role: 'ADMIN' });
    mockArticleService.createArticle.mockResolvedValue(
      makeArticleResponse({ source: 'ADMIN_UPLOADED' }),
    );
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/knowledge-articles',
      headers: authHeaders(adminJwt),
      payload: {
        title: 'AI Generated Knowledge',
        content: 'Some AI-generated content.',
        category: 'BUSINESS_PROCESS',
      },
    });

    expect(res.statusCode).toBe(201);
    // source not passed to service — defaults to ADMIN_UPLOADED
    expect(mockArticleService.createArticle).toHaveBeenCalledWith(
      TEST_COMPANY_ID,
      expect.any(String),
      expect.objectContaining({ category: 'BUSINESS_PROCESS' }),
    );
    expect(mockArticleService.createArticle).toHaveBeenCalledWith(
      TEST_COMPANY_ID,
      expect.any(String),
      expect.not.objectContaining({ source: expect.anything() }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/knowledge-articles/:id
// ---------------------------------------------------------------------------

describe('GET /ai/knowledge-articles/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns a single article', async () => {
    setupMocks();
    const article = makeArticleResponse();
    mockArticleService.getArticle.mockResolvedValue(article);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/knowledge-articles/${article.id}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(article.id);
    expect(body.data.chunkCount).toBe(2);
  });

  it('returns 404 when article not found (cross-tenant → 404 not 403)', async () => {
    setupMocks();
    mockArticleService.getArticle.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('validates UUID param format', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/knowledge-articles/not-a-uuid',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /ai/knowledge-articles/:id
// ---------------------------------------------------------------------------

describe('PATCH /ai/knowledge-articles/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('updates an article (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    const updated = makeArticleResponse({ title: 'Updated Title' });
    mockArticleService.updateArticle.mockResolvedValue(updated);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/knowledge-articles/${updated.id}`,
      headers: authHeaders(adminJwt),
      payload: { title: 'Updated Title' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when article not found', async () => {
    setupMocks({ role: 'ADMIN' });
    mockArticleService.updateArticle.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { title: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(staffJwt),
      payload: { title: 'hacked' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects source field in update body (source is immutable — .strict() rejects unknown keys)', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { source: 'AI_GENERATED' },
    });

    // .strict() on updateArticleBodySchema rejects 'source' as unrecognized key → 400
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid category with 400', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { category: 'INVALID_CATEGORY' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /ai/knowledge-articles/:id
// ---------------------------------------------------------------------------

describe('DELETE /ai/knowledge-articles/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('deletes an article and returns 204 (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockArticleService.deleteArticle.mockResolvedValue(true);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when article not found', async () => {
    setupMocks({ role: 'ADMIN' });
    mockArticleService.deleteArticle.mockResolvedValue(false);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/knowledge-articles/${randomUUID()}`,
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(403);
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockMemoryService } = vi.hoisted(
  () => ({
    mockPrisma: {
      user: { findUnique: vi.fn() },
      companyProfile: { findUnique: vi.fn() },
      aiMemorySettings: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
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
    mockMemoryService: {
      createMemory: vi.fn(),
      listMemories: vi.fn(),
      getMemory: vi.fn(),
      updateMemory: vi.fn(),
      deleteMemory: vi.fn(),
      forgetAll: vi.fn(),
      touchMemory: vi.fn(),
      calculateEffectiveImportance: vi.fn(),
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
import { memoryRoutesPlugin } from './memory.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../test-utils/jwt.js';

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

  const service = opts.withService !== false ? mockMemoryService : null;
  app.decorate('aiMemoryService', service as any);

  await app.register(memoryRoutesPlugin, { prefix: '/ai' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'STAFF';

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const aiChatPerm = {
    canAccess: true,
    canNew: false,
    canView: true,
    canEdit: false,
    canDelete: false,
  };

  mockPermissionService.getEffectivePermissions.mockResolvedValue({
    permissions: { 'ai.chat': aiChatPerm },
    fieldOverrides: {},
    accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
    role: resolvedRole,
    isSuperAdmin: resolvedRole === 'SUPER_ADMIN',
    enabledModules: ['system'],
  });

  // Default: memory settings lazy upsert returns enabled
  mockPrisma.aiMemorySettings.upsert.mockResolvedValue({
    id: 'settings-1',
    userId: TEST_USER_ID,
    companyId: TEST_COMPANY_ID,
    isEnabled: true,
    enabledCategories: ['PREFERENCE', 'WORKFLOW', 'ENTITY_CONTEXT', 'DECISION', 'INSTRUCTION'],
    retentionDays: 365,
    maxMemories: 500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function makeMemoryResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId: TEST_USER_ID,
    companyId: TEST_COMPANY_ID,
    category: 'PREFERENCE',
    content: 'User prefers dark mode',
    source: 'EXPLICIT',
    importance: 1.0,
    lastAccessedAt: new Date(),
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt({ role: 'STAFF' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: POST /ai/memories
// ---------------------------------------------------------------------------

describe('POST /ai/memories', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates a memory and returns 201', async () => {
    setupMocks();
    const memResponse = makeMemoryResponse();
    mockMemoryService.createMemory.mockResolvedValue(memResponse);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories',
      headers: authHeaders(testJwt),
      payload: {
        content: 'Always use Net 30 payment terms',
        category: 'INSTRUCTION',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(memResponse.id);
  });

  it('returns 400 for missing content', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories',
      headers: authHeaders(testJwt),
      payload: { category: 'PREFERENCE' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid category', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories',
      headers: authHeaders(testJwt),
      payload: { content: 'test', category: 'INVALID_CATEGORY' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories',
      payload: { content: 'test', category: 'PREFERENCE' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 422 when memory is disabled', async () => {
    setupMocks();
    mockPrisma.aiMemorySettings.upsert.mockResolvedValue({
      id: 'settings-1',
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      isEnabled: false,
      enabledCategories: [],
      retentionDays: 365,
      maxMemories: 500,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories',
      headers: authHeaders(testJwt),
      payload: { content: 'test', category: 'PREFERENCE' },
    });

    expect(res.statusCode).toBe(422);
    expect(mockMemoryService.createMemory).not.toHaveBeenCalled();
  });

  it('returns 503 when memory service is unavailable', async () => {
    setupMocks();
    app = await buildTestApp({ withService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories',
      headers: authHeaders(testJwt),
      payload: { content: 'test', category: 'PREFERENCE' },
    });

    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/memories
// ---------------------------------------------------------------------------

describe('GET /ai/memories', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('lists memories for current user', async () => {
    setupMocks();
    mockMemoryService.listMemories.mockResolvedValue({
      data: [makeMemoryResponse()],
      nextCursor: null,
      total: 1,
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/memories',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('passes category and search filters to service', async () => {
    setupMocks();
    mockMemoryService.listMemories.mockResolvedValue({
      data: [],
      nextCursor: null,
      total: 0,
    });
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/memories?category=INSTRUCTION&search=payment',
      headers: authHeaders(testJwt),
    });

    expect(mockMemoryService.listMemories).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_COMPANY_ID,
      expect.objectContaining({
        category: 'INSTRUCTION',
        search: 'payment',
      }),
    );
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/memories',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /ai/memories/:id
// ---------------------------------------------------------------------------

describe('PATCH /ai/memories/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('updates a memory and returns 200', async () => {
    setupMocks();
    const updated = makeMemoryResponse({ content: 'Updated content' });
    mockMemoryService.updateMemory.mockResolvedValue(updated);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/memories/${randomUUID()}`,
      headers: authHeaders(testJwt),
      payload: { content: 'Updated content' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when memory not found (wrong user)', async () => {
    setupMocks();
    mockMemoryService.updateMemory.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/memories/${randomUUID()}`,
      headers: authHeaders(testJwt),
      payload: { content: 'hacked' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('validates UUID param format', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/ai/memories/not-a-uuid',
      headers: authHeaders(testJwt),
      payload: { content: 'test' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /ai/memories/:id
// ---------------------------------------------------------------------------

describe('DELETE /ai/memories/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('deletes a memory and returns 204', async () => {
    setupMocks();
    mockMemoryService.deleteMemory.mockResolvedValue(true);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/memories/${randomUUID()}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when memory not found (wrong user)', async () => {
    setupMocks();
    mockMemoryService.deleteMemory.mockResolvedValue(false);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/memories/${randomUUID()}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /ai/memories/forget-all
// ---------------------------------------------------------------------------

describe('POST /ai/memories/forget-all', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('deletes all memories and returns count', async () => {
    setupMocks();
    mockMemoryService.forgetAll.mockResolvedValue(15);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories/forget-all',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.deletedCount).toBe(15);
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/memories/forget-all',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/memories/settings
// ---------------------------------------------------------------------------

describe('GET /ai/memories/settings', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns memory settings (lazy-created)', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/memories/settings',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.isEnabled).toBe(true);
    expect(body.data.maxMemories).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /ai/memories/settings
// ---------------------------------------------------------------------------

describe('PATCH /ai/memories/settings', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('updates memory settings', async () => {
    setupMocks();
    mockPrisma.aiMemorySettings.update.mockResolvedValue({
      id: 'settings-1',
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      isEnabled: false,
      enabledCategories: ['PREFERENCE'],
      retentionDays: 180,
      maxMemories: 250,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/ai/memories/settings',
      headers: authHeaders(testJwt),
      payload: {
        isEnabled: false,
        enabledCategories: ['PREFERENCE'],
        retentionDays: 180,
        maxMemories: 250,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.isEnabled).toBe(false);
    expect(body.data.retentionDays).toBe(180);
  });

  it('validates retentionDays bounds', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/ai/memories/settings',
      headers: authHeaders(testJwt),
      payload: { retentionDays: 0 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates maxMemories bounds', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/ai/memories/settings',
      headers: authHeaders(testJwt),
      payload: { maxMemories: 5 }, // min is 10
    });

    expect(res.statusCode).toBe(400);
  });
});

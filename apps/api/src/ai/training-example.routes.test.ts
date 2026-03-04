// ---------------------------------------------------------------------------
// Route-level tests for Training Example CRUD endpoints
// E5d-2 Task 8.9
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockExampleService } = vi.hoisted(
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
    mockExampleService: {
      createExample: vi.fn(),
      listExamples: vi.fn(),
      getExample: vi.fn(),
      updateExample: vi.fn(),
      deleteExample: vi.fn(),
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
import { trainingExampleRoutesPlugin } from './training-example.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_COMPANY_ID,
  TEST_USER_ID,
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

  const service = opts.withService !== false ? mockExampleService : null;
  app.decorate('aiTrainingExampleService', service as any);

  await app.register(trainingExampleRoutesPlugin, { prefix: '/ai' });
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

function makeExampleResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    companyId: TEST_COMPANY_ID,
    skillKey: null,
    inputText: 'What VAT for EU purchase?',
    outputText: 'Use reverse charge — VAT code 3',
    category: 'TERMINOLOGY',
    source: 'ADMIN_CURATED',
    isActive: true,
    createdById: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
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
// Tests: GET /ai/training-examples (LIST)
// ---------------------------------------------------------------------------

describe('GET /ai/training-examples', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('lists examples and returns 200', async () => {
    setupMocks();
    mockExampleService.listExamples.mockResolvedValue({
      data: [makeExampleResponse()],
      nextCursor: null,
      total: 1,
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/training-examples',
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
    mockExampleService.listExamples.mockResolvedValue({ data: [], nextCursor: null, total: 0 });
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/training-examples?category=TERMINOLOGY',
      headers: authHeaders(adminJwt),
    });

    expect(mockExampleService.listExamples).toHaveBeenCalledWith(
      TEST_COMPANY_ID,
      expect.objectContaining({ category: 'TERMINOLOGY' }),
    );
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/training-examples',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when service is unavailable', async () => {
    setupMocks();
    app = await buildTestApp({ withService: false });

    const res = await app.inject({
      method: 'GET',
      url: '/ai/training-examples',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /ai/training-examples (CREATE)
// ---------------------------------------------------------------------------

describe('POST /ai/training-examples', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates an example and returns 201 (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockExampleService.createExample.mockResolvedValue(makeExampleResponse());
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/training-examples',
      headers: authHeaders(adminJwt),
      payload: {
        inputText: 'What VAT for EU purchase?',
        outputText: 'Use reverse charge — VAT code 3',
        category: 'TERMINOLOGY',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/training-examples',
      headers: authHeaders(staffJwt),
      payload: {
        inputText: 'Q',
        outputText: 'A',
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
      url: '/ai/training-examples',
      headers: authHeaders(adminJwt),
      payload: {
        inputText: 'Q',
        outputText: 'A',
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
      url: '/ai/training-examples',
      headers: authHeaders(adminJwt),
      payload: { inputText: 'Only input' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/training-examples/:id (GET single)
// ---------------------------------------------------------------------------

describe('GET /ai/training-examples/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns a single example', async () => {
    setupMocks();
    const example = makeExampleResponse();
    mockExampleService.getExample.mockResolvedValue(example);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/training-examples/${example.id}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(example.id);
  });

  it('returns 404 when not found (cross-tenant → 404 not 403)', async () => {
    setupMocks();
    mockExampleService.getExample.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('validates UUID param format', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/training-examples/not-a-uuid',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /ai/training-examples/:id (UPDATE)
// ---------------------------------------------------------------------------

describe('PATCH /ai/training-examples/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('updates an example (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    const updated = makeExampleResponse({ inputText: 'Updated Q' });
    mockExampleService.updateExample.mockResolvedValue(updated);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/training-examples/${updated.id}`,
      headers: authHeaders(adminJwt),
      payload: { inputText: 'Updated Q' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when example not found', async () => {
    setupMocks({ role: 'ADMIN' });
    mockExampleService.updateExample.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { inputText: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(staffJwt),
      payload: { inputText: 'hacked' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects source field in update body (source is immutable)', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { source: 'CORRECTION_DERIVED' },
    });

    // The schema uses .strict() so unknown fields should be rejected
    // with either 400 (schema validation) or 422 (domain error)
    expect([400, 422]).toContain(res.statusCode);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /ai/training-examples/:id (SOFT DELETE)
// ---------------------------------------------------------------------------

describe('DELETE /ai/training-examples/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('deletes an example and returns 204 (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockExampleService.deleteExample.mockResolvedValue(true);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when example not found', async () => {
    setupMocks({ role: 'ADMIN' });
    mockExampleService.deleteExample.mockResolvedValue(false);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/training-examples/${randomUUID()}`,
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(403);
  });
});

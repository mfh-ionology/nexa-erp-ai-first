import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
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

vi.mock('../../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Mock the admin services — injected via Fastify decoration
// ---------------------------------------------------------------------------

const mockModelService = vi.hoisted(() => ({
  listModels: vi.fn(),
  getModel: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { adminRoutesPlugin } from '../admin.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_COMPANY_ID,
} from '../../../test-utils/jwt.js';

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

  // Decorate with admin services (mimicking the AI plugin)
  app.decorate('aiAdminModelService', mockModelService as any);
  app.decorate('aiAdminPromptService', null);
  app.decorate('aiAdminDashboardService', null);

  await app.register(adminRoutesPlugin, { prefix: '/admin' });
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

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(resolvedRole);

  mockPermissionService.getEffectivePermissions.mockResolvedValue({
    permissions: {},
    fieldOverrides: {},
    accessGroups: isAdmin ? [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }] : [],
    role: resolvedRole,
    isSuperAdmin: resolvedRole === 'SUPER_ADMIN',
    enabledModules: ['system'],
  });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VALID_MODEL_ID = randomUUID();

function makeModelPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'claude-opus',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    maxInputTokens: 200000,
    maxOutputTokens: 32000,
    costPerMInput: '15.00',
    costPerMOutput: '75.00',
    capabilities: {},
    isActive: true,
    isDefault: false,
    routingTags: [],
    ...overrides,
  };
}

function makeModelResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_MODEL_ID,
    name: 'claude-opus',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    maxInputTokens: 200000,
    maxOutputTokens: 32000,
    costPerMInput: '15.00',
    costPerMOutput: '75.00',
    routingTags: [],
    capabilities: {},
    isActive: true,
    isDefault: false,
    fallbackModelId: null,
    agentCount: 0,
    createdAt: '2026-03-03T12:00:00.000Z',
    updatedAt: '2026-03-03T12:00:00.000Z',
    fallbackModel: null,
    config: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let adminJwt: string;
let staffJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  adminJwt = await makeTestJwt({ role: 'ADMIN' });
  staffJwt = await makeTestJwt({ role: 'STAFF' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Model Routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // ─── CRUD lifecycle ─────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    it('POST /admin/models creates model (201)', async () => {
      setupMocks({ role: 'ADMIN' });
      const created = makeModelResponse();
      mockModelService.createModel.mockResolvedValue(created);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/models',
        headers: authHeaders(adminJwt),
        payload: makeModelPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(VALID_MODEL_ID);
      expect(body.data.name).toBe('claude-opus');
    });

    it('GET /admin/models lists models (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockModelService.listModels.mockResolvedValue({
        data: [makeModelResponse()],
        meta: { cursor: undefined, hasMore: false, total: 1 },
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/models',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('GET /admin/models/:id gets model detail (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockModelService.getModel.mockResolvedValue(makeModelResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/admin/models/${VALID_MODEL_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe(VALID_MODEL_ID);
    });

    it('PATCH /admin/models/:id updates model (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockModelService.updateModel.mockResolvedValue(makeModelResponse({ displayName: 'Updated' }));

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/models/${VALID_MODEL_ID}`,
        headers: authHeaders(adminJwt),
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.displayName).toBe('Updated');
    });

    it('DELETE /admin/models/:id deletes model (204)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockModelService.deleteModel.mockResolvedValue(undefined);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/models/${VALID_MODEL_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // ─── Business rule errors ──────────────────────────────────────

  describe('Business rule errors', () => {
    it('returns 422 on circular fallback', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockModelService.updateModel.mockRejectedValue(
        new AppError('CIRCULAR_FALLBACK', 'Circular fallback chain detected', 422),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/models/${VALID_MODEL_ID}`,
        headers: authHeaders(adminJwt),
        payload: { fallbackModelId: randomUUID() },
      });

      expect(res.statusCode).toBe(422);
    });

    it('returns 422 on deactivating default model', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockModelService.updateModel.mockRejectedValue(
        new AppError('CANNOT_DEACTIVATE_DEFAULT', 'Cannot deactivate the default model', 422),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/models/${VALID_MODEL_ID}`,
        headers: authHeaders(adminJwt),
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(422);
    });

    it('returns 422 on deleting referenced model', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockModelService.deleteModel.mockRejectedValue(
        new AppError('MODEL_REFERENCED_BY_AGENTS', 'This model is referenced by 2 agents', 422),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/models/${VALID_MODEL_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(422);
    });
  });

  // ─── Authorization ───────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects STAFF role with 403', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/models',
        headers: authHeaders(staffJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});

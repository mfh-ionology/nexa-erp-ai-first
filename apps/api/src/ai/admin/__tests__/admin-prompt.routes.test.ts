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

const mockPromptService = vi.hoisted(() => ({
  listPrompts: vi.fn(),
  getPrompt: vi.fn(),
  createPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  restoreVersion: vi.fn(),
  testRender: vi.fn(),
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
  TEST_USER_ID,
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

  app.decorate('aiAdminModelService', null);
  app.decorate('aiAdminPromptService', mockPromptService as any);
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

const VALID_PROMPT_ID = randomUUID();

function makePromptPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'record-create-invoice',
    category: 'record-creation',
    systemPrompt: 'You are an invoice creation assistant.',
    userTemplate: 'Create an invoice for {{customer_name}}.',
    parameters: [],
    isActive: true,
    ...overrides,
  };
}

function makePromptResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_PROMPT_ID,
    name: 'record-create-invoice',
    description: null,
    category: 'record-creation',
    activeVersion: 1,
    isActive: true,
    variableCount: 0,
    createdBy: TEST_USER_ID,
    createdAt: '2026-03-03T12:00:00.000Z',
    updatedAt: '2026-03-03T12:00:00.000Z',
    systemPrompt: 'You are an invoice creation assistant.',
    userTemplate: 'Create an invoice for {{customer_name}}.',
    parameters: [],
    outputFormat: null,
    variables: [],
    versionCount: 1,
    ...overrides,
  };
}

function makeVersionResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    promptId: VALID_PROMPT_ID,
    version: 1,
    changeReason: 'Initial version',
    createdBy: TEST_USER_ID,
    createdAt: '2026-03-03T12:00:00.000Z',
    snippet: 'You are an invoice creation assistant.',
    systemPrompt: 'You are an invoice creation assistant.',
    userTemplate: 'Create an invoice for {{customer_name}}.',
    parameters: [],
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

describe('Admin Prompt Routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // ─── CRUD lifecycle with version creation ──────────────────────

  describe('CRUD lifecycle', () => {
    it('POST /admin/prompts creates prompt (201)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.createPrompt.mockResolvedValue(makePromptResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/prompts',
        headers: authHeaders(adminJwt),
        payload: makePromptPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(VALID_PROMPT_ID);
      expect(body.data.activeVersion).toBe(1);
    });

    it('GET /admin/prompts lists prompts (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.listPrompts.mockResolvedValue({
        data: [makePromptResponse()],
        meta: { cursor: undefined, hasMore: false, total: 1 },
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/prompts',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
    });

    it('GET /admin/prompts/:id gets prompt detail (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.getPrompt.mockResolvedValue(makePromptResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/admin/prompts/${VALID_PROMPT_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.systemPrompt).toBe('You are an invoice creation assistant.');
    });

    it('PATCH /admin/prompts/:id updates prompt with changeReason (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.updatePrompt.mockResolvedValue(
        makePromptResponse({ activeVersion: 2, systemPrompt: 'Updated.' }),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/prompts/${VALID_PROMPT_ID}`,
        headers: authHeaders(adminJwt),
        payload: {
          systemPrompt: 'Updated.',
          changeReason: 'Improved instructions',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.activeVersion).toBe(2);
    });

    it('DELETE /admin/prompts/:id deletes prompt (204)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.deletePrompt.mockResolvedValue(undefined);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/prompts/${VALID_PROMPT_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // ─── Version endpoints ──────────────────────────────────────────

  describe('Version endpoints', () => {
    it('GET /admin/prompts/:id/versions lists versions (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.listVersions.mockResolvedValue([
        makeVersionResponse({ version: 2 }),
        makeVersionResponse({ version: 1 }),
      ]);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/admin/prompts/${VALID_PROMPT_ID}/versions`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(2);
    });

    it('POST /admin/prompts/:id/versions/:version/restore restores version (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.restoreVersion.mockResolvedValue(
        makeVersionResponse({ version: 3, changeReason: 'Restored from version 1' }),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: `/admin/prompts/${VALID_PROMPT_ID}/versions/1/restore`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.version).toBe(3);
      expect(body.data.changeReason).toBe('Restored from version 1');
    });
  });

  // ─── Test render endpoint ────────────────────────────────────────

  describe('Test render endpoint', () => {
    it('POST /admin/prompts/:id/test renders prompt (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockPromptService.testRender.mockResolvedValue({
        systemPrompt: 'Resolved system prompt.',
        userTemplate: 'Resolved user template.',
        resolvedVariables: { customer_name: 'Acme Corp' },
        unresolvedCount: 0,
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: `/admin/prompts/${VALID_PROMPT_ID}/test`,
        headers: authHeaders(adminJwt),
        payload: { sampleVariables: { customer_name: 'Acme Corp' } },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.resolvedVariables.customer_name).toBe('Acme Corp');
      expect(body.data.unresolvedCount).toBe(0);
    });
  });

  // ─── Validation ─────────────────────────────────────────────────

  describe('Validation', () => {
    it('returns 400 when changeReason is missing on update', async () => {
      setupMocks({ role: 'ADMIN' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/prompts/${VALID_PROMPT_ID}`,
        headers: authHeaders(adminJwt),
        payload: { systemPrompt: 'Updated.' },
        // changeReason is missing — required by schema
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Authorization ───────────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects STAFF role with 403', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/prompts',
        headers: authHeaders(staffJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});

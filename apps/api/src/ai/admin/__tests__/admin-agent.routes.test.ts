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

const mockAgentService = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
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
  app.decorate('aiAdminModelService', null);
  app.decorate('aiAdminPromptService', null);
  app.decorate('aiAdminDashboardService', null);
  app.decorate('aiAdminAgentService', mockAgentService as any);
  app.decorate('aiAdminSkillService', null);
  app.decorate('aiAdminTriggerTestService', null);

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

const AGENT_ID = randomUUID();
const PROMPT_ID = randomUUID();

function makeAgentPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-agent',
    displayName: 'Test Agent',
    promptId: PROMPT_ID,
    routingTags: ['standard'],
    tools: [],
    guardrails: {
      canRead: [],
      canWrite: [],
      requiresApproval: false,
      blockedOperations: [],
      dataScope: 'own',
    },
    triggerConfig: [],
    maxTurns: 10,
    isActive: true,
    ...overrides,
  };
}

function makeAgentResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    name: 'test-agent',
    displayName: 'Test Agent',
    description: null,
    modelId: null,
    modelDisplayName: null,
    promptId: PROMPT_ID,
    promptName: 'system-prompt',
    routingTags: ['standard'],
    toolCount: 0,
    maxTurns: 10,
    isActive: true,
    tools: [],
    guardrails: {
      canRead: [],
      canWrite: [],
      requiresApproval: false,
      blockedOperations: [],
      dataScope: 'own',
    },
    triggerConfig: [],
    model: null,
    prompt: { id: PROMPT_ID, name: 'system-prompt', displayName: null, category: 'system' },
    automationStepCount: 0,
    createdAt: '2026-03-03T12:00:00.000Z',
    updatedAt: '2026-03-03T12:00:00.000Z',
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

describe('Admin Agent Routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // ─── CRUD lifecycle ─────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    it('POST /admin/agents creates agent (201)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockAgentService.createAgent.mockResolvedValue(makeAgentResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/agents',
        headers: authHeaders(adminJwt),
        payload: makeAgentPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(AGENT_ID);
      expect(body.data.name).toBe('test-agent');
    });

    it('GET /admin/agents lists agents (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockAgentService.listAgents.mockResolvedValue({
        data: [makeAgentResponse()],
        meta: { cursor: undefined, hasMore: false, total: 1 },
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/agents',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('GET /admin/agents/:id gets agent detail (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockAgentService.getAgent.mockResolvedValue(makeAgentResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/admin/agents/${AGENT_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe(AGENT_ID);
      expect(body.data.automationStepCount).toBe(0);
    });

    it('PATCH /admin/agents/:id updates agent (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockAgentService.updateAgent.mockResolvedValue(makeAgentResponse({ displayName: 'Updated' }));

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/agents/${AGENT_ID}`,
        headers: authHeaders(adminJwt),
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.displayName).toBe('Updated');
    });

    it('DELETE /admin/agents/:id deletes agent (204)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockAgentService.deleteAgent.mockResolvedValue(undefined);

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/agents/${AGENT_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // ─── Business rule errors ──────────────────────────────────────

  describe('Business rule errors', () => {
    it('returns 409 on duplicate agent name', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockAgentService.createAgent.mockRejectedValue(
        new AppError('AGENT_NAME_CONFLICT', 'An agent with name "test-agent" already exists', 409),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/agents',
        headers: authHeaders(adminJwt),
        payload: makeAgentPayload(),
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error.code).toBe('AGENT_NAME_CONFLICT');
    });

    it('returns 422 on delete with automation step references', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockAgentService.deleteAgent.mockRejectedValue(
        new AppError(
          'AGENT_REFERENCED_BY_STEPS',
          'This agent is referenced by 3 automation steps',
          422,
        ),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/agents/${AGENT_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.error.code).toBe('AGENT_REFERENCED_BY_STEPS');
    });

    it('returns 422 on inactive model reference', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockAgentService.createAgent.mockRejectedValue(
        new AppError('MODEL_INACTIVE', 'Referenced model is inactive', 422),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/agents',
        headers: authHeaders(adminJwt),
        payload: makeAgentPayload({ modelId: randomUUID() }),
      });

      expect(res.statusCode).toBe(422);
    });
  });

  // ─── Authorization ───────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects STAFF role with 403 on GET /admin/agents', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/agents',
        headers: authHeaders(staffJwt),
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects STAFF role with 403 on POST /admin/agents', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/agents',
        headers: authHeaders(staffJwt),
        payload: makeAgentPayload(),
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects STAFF role with 403 on DELETE /admin/agents/:id', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/agents/${AGENT_ID}`,
        headers: authHeaders(staffJwt),
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects unauthenticated request with 401', async () => {
      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/agents',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

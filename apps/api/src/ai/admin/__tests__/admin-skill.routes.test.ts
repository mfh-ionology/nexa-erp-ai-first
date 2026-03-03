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
// Mock the admin services
// ---------------------------------------------------------------------------

const mockSkillService = vi.hoisted(() => ({
  listSkills: vi.fn(),
  listSkillsGrouped: vi.fn(),
  getSkill: vi.fn(),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
}));

const mockTriggerTestService = vi.hoisted(() => ({
  testTrigger: vi.fn(),
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
  app.decorate('aiAdminAgentService', null);
  app.decorate('aiAdminSkillService', mockSkillService as any);
  app.decorate('aiAdminTriggerTestService', mockTriggerTestService as any);

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

const SKILL_ID = randomUUID();

function makeSkillPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'ar-overdue-analysis',
    displayName: 'Overdue Invoice Analysis',
    category: 'analysis',
    skillContent: '# Overdue Invoice Analysis\nInstructions...',
    triggerPhrases: ['show me overdue invoices'],
    inputSchema: {},
    outputType: 'json',
    requiredTools: ['query_entity'],
    isActive: true,
    negativeTriggers: [],
    contextRequired: [],
    priority: 100,
    ...overrides,
  };
}

function makeSkillResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: SKILL_ID,
    name: 'ar-overdue-analysis',
    displayName: 'Overdue Invoice Analysis',
    description: null,
    category: 'analysis',
    moduleKey: 'ar',
    packKey: 'ar-analysis',
    triggerPhrases: ['show me overdue invoices'],
    negativeTriggers: [],
    orchestrationPattern: 'SEQUENTIAL',
    priority: 100,
    version: 1,
    isActive: true,
    outputType: 'json',
    requiredToolCount: 1,
    skillContent: '# Overdue Invoice Analysis\nInstructions...',
    inputSchema: {},
    requiredTools: ['query_entity'],
    contextRequired: [],
    parameters: null,
    examples: null,
    contextCount: 0,
    overrideCount: 0,
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

describe('Admin Skill Routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // ─── CRUD lifecycle with soft-delete ──────────────────────────

  describe('CRUD lifecycle with soft-delete', () => {
    it('POST /admin/skills creates skill (201)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockSkillService.createSkill.mockResolvedValue(makeSkillResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/skills',
        headers: authHeaders(adminJwt),
        payload: makeSkillPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(SKILL_ID);
      expect(body.data.name).toBe('ar-overdue-analysis');
    });

    it('GET /admin/skills lists skills flat (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockSkillService.listSkills.mockResolvedValue({
        data: [makeSkillResponse()],
        meta: { cursor: undefined, hasMore: false, total: 1 },
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/skills',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('GET /admin/skills/:id gets skill detail (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockSkillService.getSkill.mockResolvedValue(makeSkillResponse());

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: `/admin/skills/${SKILL_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe(SKILL_ID);
      expect(body.data.skillContent).toContain('Overdue Invoice Analysis');
    });

    it('PATCH /admin/skills/:id updates skill (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockSkillService.updateSkill.mockResolvedValue(makeSkillResponse({ displayName: 'Updated' }));

      app = await buildTestApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/skills/${SKILL_ID}`,
        headers: authHeaders(adminJwt),
        payload: { displayName: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.displayName).toBe('Updated');
    });

    it('DELETE /admin/skills/:id soft-deletes skill (200)', async () => {
      setupMocks({ role: 'ADMIN' });
      mockSkillService.deleteSkill.mockResolvedValue(makeSkillResponse({ isActive: false }));

      app = await buildTestApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/skills/${SKILL_ID}`,
        headers: authHeaders(adminJwt),
      });

      // Soft-delete returns 200 with the deactivated skill (not 204)
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.isActive).toBe(false);
    });
  });

  // ─── Grouped list endpoint ─────────────────────────────────────

  describe('Grouped list endpoint', () => {
    it('GET /admin/skills?grouped=true returns grouped response', async () => {
      setupMocks({ role: 'ADMIN' });
      mockSkillService.listSkillsGrouped.mockResolvedValue({
        groups: [
          { moduleKey: 'ar', skills: [makeSkillResponse()] },
          {
            moduleKey: 'finance',
            skills: [makeSkillResponse({ id: randomUUID(), moduleKey: 'finance' })],
          },
        ],
        totalCount: 2,
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/skills?grouped=true',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.groups).toHaveLength(2);
      expect(body.data.totalCount).toBe(2);
      // Verify grouped endpoint was called
      expect(mockSkillService.listSkillsGrouped).toHaveBeenCalled();
      expect(mockSkillService.listSkills).not.toHaveBeenCalled();
    });
  });

  // ─── Trigger test endpoint ──────────────────────────────────────

  describe('Trigger test endpoint', () => {
    it('POST /admin/skills/test-trigger returns match result', async () => {
      setupMocks({ role: 'ADMIN' });
      mockTriggerTestService.testTrigger.mockResolvedValue({
        matchedModule: 'ar',
        matchedSkill: {
          id: SKILL_ID,
          name: 'ar-overdue-analysis',
          displayName: 'Overdue Invoice Analysis',
          confidence: 0.85,
        },
        l0Confidence: 0.9,
        l1Confidence: 0.85,
        requiredTools: ['query_entity'],
        skillContentPreview: '# Overdue Invoice Analysis\nAnalyse overdue...',
        noMatch: false,
        suggestions: [],
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/skills/test-trigger',
        headers: authHeaders(adminJwt),
        payload: { phrase: 'show me overdue invoices' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.matchedModule).toBe('ar');
      expect(body.data.noMatch).toBe(false);
      expect(body.data.l0Confidence).toBe(0.9);
    });

    it('POST /admin/skills/test-trigger returns no match with suggestions', async () => {
      setupMocks({ role: 'ADMIN' });
      mockTriggerTestService.testTrigger.mockResolvedValue({
        matchedModule: null,
        matchedSkill: null,
        l0Confidence: 0.05,
        l1Confidence: 0,
        requiredTools: [],
        skillContentPreview: '',
        noMatch: true,
        suggestions: ['ar', 'finance', 'sales'],
      });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/skills/test-trigger',
        headers: authHeaders(adminJwt),
        payload: { phrase: 'completely unrelated query' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.noMatch).toBe(true);
      expect(body.data.suggestions).toContain('ar');
    });
  });

  // ─── Business rule errors ──────────────────────────────────────

  describe('Business rule errors', () => {
    it('returns 409 on duplicate skill name', async () => {
      setupMocks({ role: 'ADMIN' });

      const { AppError } = await import('../../../core/errors/app-error.js');
      mockSkillService.createSkill.mockRejectedValue(
        new AppError('SKILL_NAME_CONFLICT', 'A skill with this name already exists', 409),
      );

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/skills',
        headers: authHeaders(adminJwt),
        payload: makeSkillPayload(),
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error.code).toBe('SKILL_NAME_CONFLICT');
    });
  });

  // ─── Authorization ───────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects STAFF role with 403 on GET /admin/skills', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/skills',
        headers: authHeaders(staffJwt),
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects STAFF role with 403 on POST /admin/skills', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/skills',
        headers: authHeaders(staffJwt),
        payload: makeSkillPayload(),
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects STAFF role with 403 on POST /admin/skills/test-trigger', async () => {
      setupMocks({ role: 'STAFF' });

      app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/admin/skills/test-trigger',
        headers: authHeaders(staffJwt),
        payload: { phrase: 'test' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects unauthenticated request with 401', async () => {
      app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin/skills',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

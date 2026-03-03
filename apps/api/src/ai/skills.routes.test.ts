import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService, mockSkillsService } = vi.hoisted(
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
    mockSkillsService: {
      listSkills: vi.fn(),
      getSkill: vi.fn(),
      createSkill: vi.fn(),
      updateSkill: vi.fn(),
      deleteSkill: vi.fn(),
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
import { skillsRoutesPlugin } from './skills.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID as _TEST_USER_ID,
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

  const service = opts.withService !== false ? mockSkillsService : null;
  app.decorate('aiSkillsService', service as any);

  await app.register(skillsRoutesPlugin, { prefix: '/ai' });
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

function makeSkillResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    name: 'create_invoice',
    displayName: 'Create Invoice',
    description: 'Creates a new invoice',
    category: 'ar',
    skillContent: 'You create invoices.',
    triggerPhrases: ['create invoice'],
    inputSchema: { type: 'object', properties: {} },
    outputType: 'invoice',
    requiredTools: [],
    isActive: true,
    moduleKey: 'ar',
    packKey: null,
    negativeTriggers: [],
    contextRequired: [],
    parameters: null,
    examples: null,
    priority: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;
let adminJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt({ role: 'STAFF' });
  adminJwt = await makeTestJwt({ role: 'ADMIN' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/skills
// ---------------------------------------------------------------------------

describe('GET /ai/skills', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('lists skills and returns 200', async () => {
    setupMocks();
    mockSkillsService.listSkills.mockResolvedValue([makeSkillResponse()]);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/skills',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('passes moduleKey filter to service', async () => {
    setupMocks();
    mockSkillsService.listSkills.mockResolvedValue([]);
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/skills?moduleKey=ar',
      headers: authHeaders(adminJwt),
    });

    expect(mockSkillsService.listSkills).toHaveBeenCalledWith(TEST_COMPANY_ID, { moduleKey: 'ar' });
  });

  it('requires authentication', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/skills',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when skills service is unavailable', async () => {
    setupMocks();
    app = await buildTestApp({ withService: false });

    const res = await app.inject({
      method: 'GET',
      url: '/ai/skills',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /ai/skills
// ---------------------------------------------------------------------------

describe('POST /ai/skills', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates a skill and returns 201 (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    const skillResp = makeSkillResponse();
    mockSkillsService.createSkill.mockResolvedValue(skillResp);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/skills',
      headers: authHeaders(adminJwt),
      payload: {
        name: 'create_invoice',
        displayName: 'Create Invoice',
        category: 'ar',
        skillContent: 'You create invoices.',
        triggerPhrases: ['create invoice'],
        inputSchema: { type: 'object' },
        outputType: 'invoice',
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
      url: '/ai/skills',
      headers: authHeaders(testJwt),
      payload: {
        name: 'test',
        displayName: 'Test',
        category: 'test',
        skillContent: 'test',
        triggerPhrases: ['test'],
        inputSchema: { type: 'object' },
        outputType: 'text',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 400 for missing required fields', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/skills',
      headers: authHeaders(adminJwt),
      payload: { name: 'test' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/skills/:id
// ---------------------------------------------------------------------------

describe('GET /ai/skills/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns a single skill', async () => {
    setupMocks();
    const skillResp = makeSkillResponse();
    mockSkillsService.getSkill.mockResolvedValue(skillResp);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/skills/${skillResp.id}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(skillResp.id);
  });

  it('returns 404 when skill not found', async () => {
    setupMocks();
    mockSkillsService.getSkill.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/skills/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('validates UUID param format', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/skills/not-a-uuid',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /ai/skills/:id
// ---------------------------------------------------------------------------

describe('PATCH /ai/skills/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('updates a skill (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    const updated = makeSkillResponse({ displayName: 'Updated Name' });
    mockSkillsService.updateSkill.mockResolvedValue(updated);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/skills/${updated.id}`,
      headers: authHeaders(adminJwt),
      payload: { displayName: 'Updated Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when skill not found', async () => {
    setupMocks({ role: 'ADMIN' });
    mockSkillsService.updateSkill.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/skills/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { displayName: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/ai/skills/${randomUUID()}`,
      headers: authHeaders(testJwt),
      payload: { displayName: 'hacked' },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /ai/skills/:id
// ---------------------------------------------------------------------------

describe('DELETE /ai/skills/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('deletes a skill and returns 204 (ADMIN)', async () => {
    setupMocks({ role: 'ADMIN' });
    mockSkillsService.deleteSkill.mockResolvedValue(true);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/skills/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when skill not found', async () => {
    setupMocks({ role: 'ADMIN' });
    mockSkillsService.deleteSkill.mockResolvedValue(false);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/skills/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects STAFF role (RBAC — ADMIN only)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/ai/skills/${randomUUID()}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
  });
});

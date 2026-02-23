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

vi.mock('../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Mock BriefingEngine and SuggestionsService
// ---------------------------------------------------------------------------

const mockBriefingEngine = vi.hoisted(() => ({
  generateBriefing: vi.fn(),
  invalidateBriefing: vi.fn(),
  invalidateCompanyBriefings: vi.fn(),
}));

const mockSuggestionsService = vi.hoisted(() => ({
  getSuggestions: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../core/middleware/company-context.js';
import { registerErrorHandler } from '../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../core/validation/index.js';
import { briefingRoutesPlugin } from './briefing.routes.js';
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

async function buildTestApp(opts: {
  withBriefingEngine?: boolean;
  withSuggestionsService?: boolean;
} = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate with services (mimicking the AI plugin)
  const briefing = opts.withBriefingEngine !== false ? mockBriefingEngine : null;
  const suggestions = opts.withSuggestionsService !== false ? mockSuggestionsService : null;
  app.decorate('aiBriefingEngine', briefing as any);
  app.decorate('aiSuggestionsService', suggestions as any);

  await app.register(briefingRoutesPlugin, { prefix: '/ai' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string; hasPermission?: boolean; permissionCode?: string } = {}) {
  const resolvedRole = config.role ?? 'MANAGER';
  const hasPermission = config.hasPermission ?? true;
  const permCode = config.permissionCode ?? 'ai.briefing';

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const perm = { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false };

  if (resolvedRole === 'SUPER_ADMIN') {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { [permCode]: perm, 'ai.briefing': perm, 'ai.suggestions': perm },
      fieldOverrides: {},
      accessGroups: [],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else if (hasPermission) {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { [permCode]: perm, 'ai.briefing': perm, 'ai.suggestions': perm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system'],
    });
  } else {
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
// Test data factories
// ---------------------------------------------------------------------------

function makeBriefingResponse() {
  return {
    generatedAt: '2026-02-23T08:00:00.000Z',
    userId: TEST_USER_ID,
    role: 'FINANCE',
    greeting: 'Good morning, Mohammed.',
    summary: 'You have 3 overdue invoices and 2 pending approvals.',
    items: [
      {
        id: randomUUID(),
        title: '3 Overdue Invoices',
        description: 'Total outstanding: £12,400',
        category: 'overdue',
        priority: 'high',
        metric: {
          value: '£12,400',
          delta: '+12%',
          trend: 'up',
          comparisonPeriod: 'vs last month',
        },
        actions: [
          {
            label: 'Review',
            actionType: 'navigate',
            route: '/ar/invoices?status=overdue',
          },
        ],
        entityLink: {
          entityType: 'CustomerInvoice',
          route: '/ar/invoices?status=overdue',
        },
      },
    ],
    cachedAt: '2026-02-23T06:00:00.000Z',
    isStale: false,
  };
}

function makeSuggestionsResponse() {
  return {
    entityType: 'Customer',
    entityId: randomUUID(),
    pageRoute: '/ar/customers/123',
    suggestions: [
      {
        id: randomUUID(),
        label: 'Invoice this customer',
        prompt: 'Create an invoice for this customer',
        category: 'action',
        icon: 'receipt',
        priority: 10,
      },
      {
        id: randomUUID(),
        label: 'Show payment history',
        prompt: 'Show payment history for this customer',
        category: 'query',
        icon: 'history',
        priority: 20,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt({ role: 'MANAGER' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /ai/briefing
// ---------------------------------------------------------------------------

describe('GET /ai/briefing', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with cached briefing on cache hit', async () => {
    setupMocks({ role: 'MANAGER' });
    const briefing = makeBriefingResponse();
    mockBriefingEngine.generateBriefing.mockResolvedValue(briefing);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/briefing',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.greeting).toBe('Good morning, Mohammed.');
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].title).toBe('3 Overdue Invoices');
    expect(body.data.role).toBe('FINANCE');
  });

  it('passes correct parameters to BriefingEngine', async () => {
    setupMocks({ role: 'MANAGER' });
    mockBriefingEngine.generateBriefing.mockResolvedValue(makeBriefingResponse());
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/briefing',
      headers: authHeaders(testJwt),
    });

    expect(mockBriefingEngine.generateBriefing).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_COMPANY_ID,
      TEST_COMPANY_ID, // tenantId
      false, // forceRefresh defaults to false
    );
  });

  it('passes forceRefresh=true when query param set', async () => {
    setupMocks({ role: 'MANAGER' });
    mockBriefingEngine.generateBriefing.mockResolvedValue(makeBriefingResponse());
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/ai/briefing?forceRefresh=true',
      headers: authHeaders(testJwt),
    });

    expect(mockBriefingEngine.generateBriefing).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_COMPANY_ID,
      TEST_COMPANY_ID,
      true,
    );
  });

  it('returns 503 when briefing engine is null (AI degraded)', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withBriefingEngine: false });

    const res = await app.inject({
      method: 'GET',
      url: '/ai/briefing',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_DEGRADED');
    expect(body.error.messageKey).toBe('ai.error.degraded');
  });

  it('returns 403 for unauthorised users without ai.briefing permission', async () => {
    setupMocks({ role: 'VIEWER', hasPermission: false });
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/briefing',
      headers: authHeaders(viewerJwt),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/briefing',
    });

    expect(res.statusCode).toBe(401);
  });

  it('response envelope matches API contract format', async () => {
    setupMocks({ role: 'MANAGER' });
    const briefing = makeBriefingResponse();
    mockBriefingEngine.generateBriefing.mockResolvedValue(briefing);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/briefing',
      headers: authHeaders(testJwt),
    });

    const body = res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('generatedAt');
    expect(body.data).toHaveProperty('userId');
    expect(body.data).toHaveProperty('role');
    expect(body.data).toHaveProperty('greeting');
    expect(body.data).toHaveProperty('summary');
    expect(body.data).toHaveProperty('items');
    expect(Array.isArray(body.data.items)).toBe(true);

    // Validate briefing item structure
    const item = body.data.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('category');
    expect(item).toHaveProperty('priority');
    expect(item).toHaveProperty('actions');
    expect(item.actions[0]).toHaveProperty('label');
    expect(item.actions[0]).toHaveProperty('actionType');
  });
});

// ---------------------------------------------------------------------------
// POST /ai/suggestions
// ---------------------------------------------------------------------------

describe('POST /ai/suggestions', () => {
  let app: FastifyInstance;
  afterEach(async () => { await app?.close(); });

  it('returns 200 with context-specific suggestions', async () => {
    setupMocks({ role: 'MANAGER' });
    const suggestions = makeSuggestionsResponse();
    mockSuggestionsService.getSuggestions.mockResolvedValue(suggestions);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      headers: authHeaders(testJwt),
      payload: {
        entityType: 'Customer',
        entityId: suggestions.entityId,
        pageRoute: '/ar/customers/123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.suggestions).toHaveLength(2);
    expect(body.data.suggestions[0].label).toBe('Invoice this customer');
    expect(body.data.pageRoute).toBe('/ar/customers/123');
  });

  it('passes correct parameters to SuggestionsService', async () => {
    setupMocks({ role: 'MANAGER' });
    mockSuggestionsService.getSuggestions.mockResolvedValue(makeSuggestionsResponse());
    app = await buildTestApp();

    const entityId = randomUUID();
    await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      headers: authHeaders(testJwt),
      payload: {
        entityType: 'Customer',
        entityId,
        pageRoute: '/ar/customers/123',
      },
    });

    expect(mockSuggestionsService.getSuggestions).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      tenantId: TEST_COMPANY_ID,
      entityType: 'Customer',
      entityId,
      pageRoute: '/ar/customers/123',
    });
  });

  it('accepts empty body (all fields optional)', async () => {
    setupMocks({ role: 'MANAGER' });
    mockSuggestionsService.getSuggestions.mockResolvedValue({
      suggestions: [],
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      headers: authHeaders(testJwt),
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.suggestions).toHaveLength(0);
  });

  it('returns 503 when suggestions service is null (AI degraded)', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withSuggestionsService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      headers: authHeaders(testJwt),
      payload: { pageRoute: '/' },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_DEGRADED');
    expect(body.error.messageKey).toBe('ai.error.degraded');
  });

  it('returns 403 for unauthorised users without ai.suggestions permission', async () => {
    setupMocks({ role: 'VIEWER', hasPermission: false });
    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      headers: authHeaders(viewerJwt),
      payload: { pageRoute: '/' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      payload: { pageRoute: '/' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('response envelope matches API contract format', async () => {
    setupMocks({ role: 'MANAGER' });
    const suggestions = makeSuggestionsResponse();
    mockSuggestionsService.getSuggestions.mockResolvedValue(suggestions);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/suggestions',
      headers: authHeaders(testJwt),
      payload: { pageRoute: '/ar/customers/123' },
    });

    const body = res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('suggestions');
    expect(Array.isArray(body.data.suggestions)).toBe(true);

    // Validate suggestion chip structure
    const chip = body.data.suggestions[0];
    expect(chip).toHaveProperty('id');
    expect(chip).toHaveProperty('label');
    expect(chip).toHaveProperty('prompt');
    expect(chip).toHaveProperty('category');
    expect(chip).toHaveProperty('priority');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: Both routes return 503 when services are null
// ---------------------------------------------------------------------------

describe('Both briefing routes return 503 when AI degraded', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp({ withBriefingEngine: false, withSuggestionsService: false });
  });

  afterEach(async () => { await app?.close(); });

  const routes: Array<{ method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> }> = [
    { method: 'GET', url: '/ai/briefing' },
    { method: 'POST', url: '/ai/suggestions', payload: { pageRoute: '/' } },
  ];

  for (const route of routes) {
    it(`${route.method} ${route.url} returns 503`, async () => {
      const res = await app.inject({
        method: route.method,
        url: route.url,
        headers: authHeaders(testJwt),
        ...(route.payload ? { payload: route.payload } : {}),
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AI_DEGRADED');
    });
  }
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockResolveUserRole,
  mockPermissionService,
  mockOrchestrator,
  mockContextEngine,
  mockRedis,
  mockLogger,
} = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    customerInvoice: { findMany: vi.fn() },
    supplierInvoice: { findMany: vi.fn() },
    bankAccount: { findMany: vi.fn() },
    purchaseOrder: { findMany: vi.fn() },
    aiAgent: { findMany: vi.fn() },
  } as Record<string, any>,
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
  mockOrchestrator: {
    process: vi.fn(),
    processDirect: vi.fn(),
  },
  mockContextEngine: {
    getUserContext: vi.fn(),
    updateContext: vi.fn(),
    refreshContext: vi.fn(),
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../core/middleware/company-context.js';
import { registerErrorHandler } from '../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../core/validation/index.js';
import { briefingRoutesPlugin } from './briefing.routes.js';
import { BriefingEngine } from './briefing-engine.js';
import { SuggestionsService } from './suggestions.service.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Helpers — build a real BriefingEngine + SuggestionsService wired into Fastify
// ---------------------------------------------------------------------------

async function buildIntegrationApp(opts: {
  withBriefingEngine?: boolean;
  withSuggestionsService?: boolean;
} = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  if (opts.withBriefingEngine !== false) {
    const briefingEngine = new BriefingEngine(
      mockOrchestrator as any,
      mockContextEngine as any,
      mockPrisma as any,
      mockRedis as any,
      mockLogger as any,
    );
    app.decorate('aiBriefingEngine', briefingEngine as any);
  } else {
    app.decorate('aiBriefingEngine', null);
  }

  if (opts.withSuggestionsService !== false) {
    const suggestionsService = new SuggestionsService(
      mockPrisma as any,
      mockContextEngine as any,
      mockPermissionService as any,
      mockLogger as any,
    );
    app.decorate('aiSuggestionsService', suggestionsService as any);
  } else {
    app.decorate('aiSuggestionsService', null);
  }

  await app.register(briefingRoutesPlugin, { prefix: '/ai' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string; hasPermission?: boolean } = {}) {
  const resolvedRole = config.role ?? 'MANAGER';
  const hasPermission = config.hasPermission ?? true;

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const perm = { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false };

  if (resolvedRole === 'SUPER_ADMIN') {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'ai.briefing': perm, 'ai.suggestions': perm },
      fieldOverrides: {},
      accessGroups: [],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system', 'ar', 'ap', 'sales', 'finance', 'hr', 'inventory'],
    });
  } else if (hasPermission) {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'ai.briefing': perm, 'ai.suggestions': perm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system', 'ar', 'ap', 'sales', 'finance'],
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

  // Default: financial models return empty
  mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
  mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
  mockPrisma.bankAccount.findMany.mockResolvedValue([]);
  mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
  mockPrisma.aiAgent.findMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Default user context
// ---------------------------------------------------------------------------

const defaultUserContext = {
  user: { id: TEST_USER_ID, name: 'Mohammed Hussein', role: 'SUPER_ADMIN' },
  tenant: { id: TEST_COMPANY_ID, companyName: 'Acme Ltd', baseCurrency: 'GBP' },
  recentEntities: [],
  recentActions: [],
  currentPeriod: { start: '2026-02-01', end: '2026-02-28', isLocked: false },
  preferences: { dateFormat: 'DD/MM/YYYY', locale: 'en' },
};

// ---------------------------------------------------------------------------
// AI response factory
// ---------------------------------------------------------------------------

function makeValidAiBriefingResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    summary: 'You have 3 overdue invoices and £25,000 in your accounts.',
    items: [
      {
        id: 'item-1',
        title: '3 Overdue Invoices',
        description: 'Total outstanding: £12,400',
        category: 'overdue_receivables',
        priority: 'high',
        metric: {
          value: '£12,400',
          delta: '+8%',
          trend: 'up',
          comparisonPeriod: 'vs last month',
        },
        actions: [
          { label: 'Chase All', actionType: 'chase', route: '/ar/invoices?status=overdue' },
          { label: 'Review', actionType: 'navigate', route: '/ar/invoices?status=overdue' },
        ],
        entityLink: {
          entityType: 'CustomerInvoice',
          route: '/ar/invoices?status=overdue',
        },
      },
      {
        id: 'item-2',
        title: 'Cash Position',
        description: 'Current balance: £25,000 across 2 accounts',
        category: 'cash_position',
        priority: 'medium',
        metric: { value: '£25,000', trend: 'flat' },
        actions: [
          { label: 'View Accounts', actionType: 'navigate', route: '/finance/bank-accounts' },
        ],
      },
    ],
    ...overrides,
  });
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

// ===========================================================================
// Integration Tests: End-to-end briefing and suggestion flow
// ===========================================================================

describe('Briefing Integration Tests', () => {
  // ─── Full flow: cache miss → data gathering → AI call → parse → cache → response ──

  describe('GET /ai/briefing — full flow with cache miss', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('gathers data, calls AI, parses response, caches, and returns briefing', async () => {
      setupMocks({ role: 'SUPER_ADMIN' });
      const superJwt = await makeTestJwt({ role: 'SUPER_ADMIN' });

      // Context engine returns user context
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      // Redis cache miss
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      // Financial data
      mockPrisma.customerInvoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: '5000.00' },
        { id: 'inv-2', totalAmount: '7400.00' },
      ]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([
        { id: 'bill-1', totalAmount: '3000.00' },
      ]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '15000.00', currency: 'GBP' },
        { id: 'ba-2', balance: '10000.00', currency: 'GBP' },
      ]);

      // AI orchestrator returns structured briefing
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-briefing-1',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(superJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      // Verify briefing structure
      expect(body.data.generatedAt).toBeDefined();
      expect(body.data.userId).toBe(TEST_USER_ID);
      expect(body.data.role).toBe('OWNER'); // SUPER_ADMIN maps to OWNER
      expect(body.data.greeting).toMatch(/Good (morning|afternoon|evening), Mohammed\./);
      expect(body.data.summary).toContain('overdue invoices');
      expect(body.data.items).toHaveLength(2);

      // Verify item structure
      const item = body.data.items[0];
      expect(item.title).toBe('3 Overdue Invoices');
      expect(item.priority).toBe('high');
      expect(item.actions).toHaveLength(2);
      expect(item.actions[0].actionType).toBe('chase');
      expect(item.entityLink.entityType).toBe('CustomerInvoice');

      // Verify metric data
      expect(item.metric.value).toBe('£12,400');
      expect(item.metric.delta).toBe('+8%');
      expect(item.metric.trend).toBe('up');

      // Verify context engine was called
      expect(mockContextEngine.getUserContext).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_COMPANY_ID,
        TEST_COMPANY_ID,
      );

      // Verify AI orchestrator was called with correct params
      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      const aiCall = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(aiCall.intent).toBe('briefing');
      expect(aiCall.routingTags).toEqual(['briefing']);
      expect(aiCall.systemPrompt).toContain('OWNER');
      expect(aiCall.userMessage).toContain('Mohammed Hussein');
      expect(aiCall.userMessage).toContain('Acme Ltd');
      // Financial data should be in the prompt
      expect(aiCall.userMessage).toContain('12400.00');  // overdue invoices total
      expect(aiCall.userMessage).toContain('25000.00');  // cash position

      // Verify result was cached in Redis
      expect(mockRedis.set).toHaveBeenCalledOnce();
      const setArgs = mockRedis.set.mock.calls[0]!;
      expect(setArgs[0]).toBe(`${TEST_COMPANY_ID}:briefing:${TEST_USER_ID}:${TEST_COMPANY_ID}`);
      expect(setArgs[2]).toBe('EX');
      expect(setArgs[3]).toBe(86_400); // 24h TTL
      expect(body.data.cachedAt).toBeDefined();
    });

    it('includes gathered financial data in the AI prompt', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: TEST_USER_ID, name: 'Jane Finance', role: 'FINANCE_MANAGER' },
      });
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      mockPrisma.customerInvoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: '9500.00' },
      ]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([
        { id: 'bill-1', totalAmount: '4200.50' },
      ]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-1', balance: '32000.00', currency: 'GBP' },
      ]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-briefing-2',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      const aiCall = mockOrchestrator.processDirect.mock.calls[0]![0];
      // Verify role-specific prompt
      expect(aiCall.systemPrompt).toContain('FINANCE');
      // Verify gathered data in prompt
      expect(aiCall.userMessage).toContain('9500.00');   // overdue invoices
      expect(aiCall.userMessage).toContain('4200.50');   // overdue bills
      expect(aiCall.userMessage).toContain('32000.00');  // cash position
      expect(aiCall.userMessage).toContain('Jane Finance');
    });
  });

  // ─── Full flow with cache hit ─────────────────────────────────────────────

  describe('GET /ai/briefing — full flow with cache hit', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns cached briefing without calling AI or gathering data', async () => {
      setupMocks({ role: 'MANAGER' });

      const cachedBriefing = {
        generatedAt: '2026-02-23T06:00:00.000Z',
        userId: TEST_USER_ID,
        role: 'OWNER',
        greeting: 'Good morning, Mohammed.',
        summary: 'Cached briefing summary from this morning.',
        items: [
          {
            id: 'cached-1',
            title: '2 Pending Approvals',
            description: 'Awaiting your review',
            category: 'approvals',
            priority: 'high',
            actions: [{ label: 'Review', actionType: 'navigate', route: '/approvals' }],
          },
        ],
        cachedAt: new Date().toISOString(),
        isStale: false,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedBriefing));

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.summary).toBe('Cached briefing summary from this morning.');
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].title).toBe('2 Pending Approvals');

      // No AI call should have been made
      expect(mockOrchestrator.processDirect).not.toHaveBeenCalled();
      // No context engine call (data gathering skipped)
      expect(mockContextEngine.getUserContext).not.toHaveBeenCalled();
      // No financial data queries
      expect(mockPrisma.customerInvoice.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.supplierInvoice.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.bankAccount.findMany).not.toHaveBeenCalled();
    });

    it('bypasses cache and regenerates when forceRefresh=true', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.set.mockResolvedValue('OK');

      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-fresh',
        content: makeValidAiBriefingResponse({ summary: 'Freshly generated briefing.' }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing?forceRefresh=true',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.summary).toBe('Freshly generated briefing.');

      // Should NOT read from cache
      expect(mockRedis.get).not.toHaveBeenCalled();
      // Should call AI
      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      // Should write new result to cache
      expect(mockRedis.set).toHaveBeenCalledOnce();
    });
  });

  // ─── Empty database — graceful degradation ────────────────────────────────

  describe('GET /ai/briefing — empty database graceful degradation', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('generates briefing with informational items when DB is empty', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      // All financial models return empty
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-empty-1',
        content: JSON.stringify({
          summary: 'No data to report today. Your system is ready to use.',
          items: [
            {
              id: 'item-setup',
              title: 'Getting Started',
              description: 'No business data available yet. Start by adding customers and invoices.',
              category: 'system',
              priority: 'low',
              actions: [{ label: 'Go to Setup', actionType: 'navigate', route: '/settings' }],
            },
          ],
        }),
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.summary).toContain('No data to report');
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].title).toBe('Getting Started');
      expect(body.data.items[0].actions[0].route).toBe('/settings');

      // Verify AI prompt shows zeroed data for role-relevant categories
      const aiCall = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(aiCall.userMessage).toContain('0 invoices');
      // OWNER role does not include supplier bills — only role-relevant data is in the prompt
    });

    it('generates briefing when Prisma models do not exist (pre-E14)', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      // Build with a Prisma client that has NO financial models
      const limitedPrisma = {
        user: mockPrisma.user,
        companyProfile: mockPrisma.companyProfile,
        aiAgent: mockPrisma.aiAgent,
        // No customerInvoice, supplierInvoice, bankAccount
      };

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-no-models',
        content: makeValidAiBriefingResponse({ summary: 'Limited data briefing.' }),
      });

      const appNoModels = Fastify({ logger: false });
      appNoModels.setValidatorCompiler(zodValidatorCompiler);
      appNoModels.setSerializerCompiler(zodSerializerCompiler);
      registerErrorHandler(appNoModels);
      await appNoModels.register(jwtVerifyPlugin);
      await appNoModels.register(companyContextPlugin);

      const briefingEngine = new BriefingEngine(
        mockOrchestrator as any,
        mockContextEngine as any,
        limitedPrisma as any,
        mockRedis as any,
        mockLogger as any,
      );
      const suggestionsService = new SuggestionsService(
        limitedPrisma as any,
        mockContextEngine as any,
        mockPermissionService as any,
        mockLogger as any,
      );
      appNoModels.decorate('aiBriefingEngine', briefingEngine as any);
      appNoModels.decorate('aiSuggestionsService', suggestionsService as any);
      await appNoModels.register(briefingRoutesPlugin, { prefix: '/ai' });
      await appNoModels.ready();
      app = appNoModels;

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      // AI was still called — briefing generated with default empty data
      expect(mockOrchestrator.processDirect).toHaveBeenCalledOnce();
      // Logger warned about missing models
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ─── Suggestions with various page contexts ──────────────────────────────

  describe('POST /ai/suggestions — various page contexts', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('returns customer detail suggestions for /ar/customers/:id', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: {
          entityType: 'Customer',
          entityId: 'cust-123',
          pageRoute: '/ar/customers/cust-123',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.entityType).toBe('Customer');
      expect(body.data.entityId).toBe('cust-123');
      expect(body.data.pageRoute).toBe('/ar/customers/cust-123');

      // Should include customer detail page suggestions
      const labels = body.data.suggestions.map((s: any) => s.label);
      expect(labels).toContain('Invoice this customer');
      expect(labels).toContain('Show payment history');
      expect(labels).toContain('Credit check');
      expect(labels).toContain('View outstanding');

      // Should also include role-based suggestions (OWNER for SUPER_ADMIN)
      expect(labels).toContain('Business overview');

      // All suggestions have required fields
      for (const s of body.data.suggestions) {
        expect(s.id).toBeDefined();
        expect(s.label).toBeDefined();
        expect(s.prompt).toBeDefined();
        expect(s.category).toBeDefined();
        expect(typeof s.priority).toBe('number');
      }
    });

    it('returns invoice list suggestions for /ar/invoices', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: TEST_USER_ID, name: 'Sarah Finance', role: 'FINANCE_MANAGER' },
      });

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/ar/invoices' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const labels = body.data.suggestions.map((s: any) => s.label);

      // Page suggestions
      expect(labels).toContain('Show overdue');
      expect(labels).toContain('Create invoice');
      // Finance role suggestions
      expect(labels).toContain('Bank reconciliation');
      expect(labels).toContain('Cash flow forecast');
    });

    it('returns dashboard suggestions for / route', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const labels = body.data.suggestions.map((s: any) => s.label);

      // Dashboard page suggestions
      expect(labels).toContain('Morning briefing');
      expect(labels).toContain('What needs my attention?');
    });

    it('returns supplier detail suggestions for /ap/suppliers/:id', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: {
          entityType: 'Supplier',
          entityId: 'sup-456',
          pageRoute: '/ap/suppliers/sup-456',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const labels = body.data.suggestions.map((s: any) => s.label);

      expect(labels).toContain('Create PO');
      expect(labels).toContain('Show outstanding bills');
      expect(labels).toContain('Payment history');
    });

    it('returns generic list suggestions for unrecognised list routes', async () => {
      setupMocks({ role: 'SUPER_ADMIN' });
      const superJwt = await makeTestJwt({ role: 'SUPER_ADMIN' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(superJwt),
        payload: { pageRoute: '/crm/contacts' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const labels = body.data.suggestions.map((s: any) => s.label);

      // Generic list suggestions — SUPER_ADMIN sees all (including "Export" which requires reporting module)
      expect(labels).toContain('Create new');
      expect(labels).toContain('Export');
      expect(labels).toContain('Show summary');
    });

    it('deduplicates suggestions with identical prompts', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // "Show my daily briefing" appears in both page and time suggestions — should be deduplicated
      const briefingPrompts = body.data.suggestions.filter(
        (s: any) => s.prompt.toLowerCase() === 'show my daily briefing',
      );
      expect(briefingPrompts.length).toBe(1);
    });

    it('sorts suggestions by priority ascending', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/ar/customers/cust-1' },
      });

      expect(res.statusCode).toBe(200);
      const priorities = res.json().data.suggestions.map((s: any) => s.priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
      }
    });

    it('includes agent preset prompts in suggestions', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      mockPrisma.aiAgent.findMany.mockResolvedValue([
        {
          name: 'finance-helper',
          triggerConfig: {
            presetPrompts: [
              { label: 'Run month-end', prompt: 'Execute month-end closing', category: 'action', priority: 250 },
            ],
          },
        },
      ]);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const labels = res.json().data.suggestions.map((s: any) => s.label);
      expect(labels).toContain('Run month-end');
    });
  });

  // ─── Graceful degradation: AI unavailable → 503 → no side effects ────────

  describe('Graceful degradation — AI unavailable', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('GET /ai/briefing returns 503 when BriefingEngine is null', async () => {
      setupMocks({ role: 'MANAGER' });
      app = await buildIntegrationApp({ withBriefingEngine: false });

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

      // No side effects — no DB queries, no cache writes
      expect(mockOrchestrator.processDirect).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('POST /ai/suggestions returns 503 when SuggestionsService is null', async () => {
      setupMocks({ role: 'MANAGER' });
      app = await buildIntegrationApp({ withSuggestionsService: false });

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/ar/invoices' },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AI_DEGRADED');

      // No side effects
      expect(mockContextEngine.getUserContext).not.toHaveBeenCalled();
    });

    it('briefing returns fallback when orchestrator throws', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.get.mockResolvedValue(null);

      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockRejectedValue(new Error('AI Gateway timeout'));

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      // BriefingEngine catches the error and returns a fallback — not a 503
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.summary).toContain('could not be generated');
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].title).toBe('Briefing Unavailable');
      expect(body.data.items[0].actions[0].route).toBe('/');
    });

    it('suggestions returns empty when context engine fails', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockRejectedValue(new Error('Redis down'));

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/ar/invoices' },
      });

      // SuggestionsService catches error and returns empty
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.suggestions).toEqual([]);
      expect(body.data.pageRoute).toBe('/ar/invoices');
    });
  });

  // ─── Cross-module data gathering pattern verification (Task 7.2) ──────────

  describe('Cross-module data gathering verification', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    // FINANCE role queries all data categories (invoices, bills, cash, approvals, payment runs)
    const financeUserContext = {
      ...defaultUserContext,
      user: { ...defaultUserContext.user, role: 'FINANCE_MANAGER' },
    };

    it('all financial queries are scoped by companyId', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(financeUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-scope',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      // Verify companyId scoping on all financial queries
      for (const model of [
        mockPrisma.customerInvoice,
        mockPrisma.supplierInvoice,
        mockPrisma.bankAccount,
        mockPrisma.purchaseOrder,
      ]) {
        expect(model.findMany).toHaveBeenCalled();
        const whereArg = model.findMany.mock.calls[0]?.[0]?.where;
        expect(whereArg?.companyId).toBe(TEST_COMPANY_ID);
      }
    });

    it('all financial queries are capped with take parameter', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(financeUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-cap',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      // Verify take parameter on all financial queries
      for (const model of [
        mockPrisma.customerInvoice,
        mockPrisma.supplierInvoice,
        mockPrisma.bankAccount,
        mockPrisma.purchaseOrder,
      ]) {
        const queryArgs = model.findMany.mock.calls[0]?.[0];
        expect(queryArgs?.take).toBe(100); // MAX_RECORDS_PER_CATEGORY
      }
    });

    it('safeModelQuery rejects models not in the allowlist', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      // Add a rogue model that should NOT be queried
      mockPrisma.dangerousModel = { findMany: vi.fn() };
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-allowlist',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      // dangerousModel should NOT have been queried
      expect(mockPrisma.dangerousModel.findMany).not.toHaveBeenCalled();

      // Clean up
      delete mockPrisma.dangerousModel;
    });

    it('overdue invoice queries use correct status filter and date comparison', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(financeUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-filter',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      // Verify customer invoice query filters
      const invoiceWhere = mockPrisma.customerInvoice.findMany.mock.calls[0]?.[0]?.where;
      expect(invoiceWhere.status).toEqual({ in: ['SENT', 'OVERDUE'] });
      expect(invoiceWhere.dueDate).toEqual({ lt: expect.any(Date) });

      // Verify supplier invoice query filters
      const billWhere = mockPrisma.supplierInvoice.findMany.mock.calls[0]?.[0]?.where;
      expect(billWhere.status).toEqual({ in: ['APPROVED', 'OVERDUE'] });
      expect(billWhere.dueDate).toEqual({ lt: expect.any(Date) });

      // Verify bank account query filters
      const bankWhere = mockPrisma.bankAccount.findMany.mock.calls[0]?.[0]?.where;
      expect(bankWhere.isActive).toBe(true);
    });

    it('bank account balance only sums accounts matching tenant base currency', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: 'ba-gbp-1', balance: '10000.00', currency: 'GBP' },
        { id: 'ba-gbp-2', balance: '5000.00', currency: 'GBP' },
        { id: 'ba-usd', balance: '8000.00', currency: 'USD' }, // different currency — excluded
      ]);

      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-currency',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

      await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(testJwt),
      });

      // The prompt should contain 15000.00 (only GBP accounts summed)
      const aiCall = mockOrchestrator.processDirect.mock.calls[0]![0];
      expect(aiCall.userMessage).toContain('15000.00');
      // Only 2 matching-currency (GBP) accounts counted
      expect(aiCall.userMessage).toContain('2 account');
    });
  });

  // ─── Authentication and authorisation ──────────────────────────────────────

  describe('Authentication and authorisation', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('GET /ai/briefing returns 401 without JWT', async () => {
      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
      });

      expect(res.statusCode).toBe(401);
    });

    it('POST /ai/suggestions returns 401 without JWT', async () => {
      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        payload: { pageRoute: '/' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('GET /ai/briefing returns 403 without ai.briefing permission', async () => {
      setupMocks({ role: 'VIEWER', hasPermission: false });
      const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'GET',
        url: '/ai/briefing',
        headers: authHeaders(viewerJwt),
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('POST /ai/suggestions returns 403 without ai.suggestions permission', async () => {
      setupMocks({ role: 'VIEWER', hasPermission: false });
      const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(viewerJwt),
        payload: { pageRoute: '/' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });
  });

  // ─── Response envelope format ───────────────────────────────────────────────

  describe('Response envelope matches API contract', () => {
    let app: FastifyInstance;
    afterEach(async () => { await app?.close(); });

    it('GET /ai/briefing returns correct envelope structure', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockPrisma.customerInvoice.findMany.mockResolvedValue([]);
      mockPrisma.supplierInvoice.findMany.mockResolvedValue([]);
      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockOrchestrator.processDirect.mockResolvedValue({
        type: 'text',
        messageId: 'msg-env',
        content: makeValidAiBriefingResponse(),
      });

      app = await buildIntegrationApp();

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
      if (body.data.items.length > 0) {
        const item = body.data.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('priority');
        expect(item).toHaveProperty('actions');
        expect(Array.isArray(item.actions)).toBe(true);
        expect(item.actions[0]).toHaveProperty('label');
        expect(item.actions[0]).toHaveProperty('actionType');
      }
    });

    it('POST /ai/suggestions returns correct envelope structure', async () => {
      setupMocks({ role: 'MANAGER' });
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      app = await buildIntegrationApp();

      const res = await app.inject({
        method: 'POST',
        url: '/ai/suggestions',
        headers: authHeaders(testJwt),
        payload: { pageRoute: '/ar/customers/cust-1' },
      });

      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('suggestions');
      expect(Array.isArray(body.data.suggestions)).toBe(true);

      if (body.data.suggestions.length > 0) {
        const chip = body.data.suggestions[0];
        expect(chip).toHaveProperty('id');
        expect(chip).toHaveProperty('label');
        expect(chip).toHaveProperty('prompt');
        expect(chip).toHaveProperty('category');
        expect(chip).toHaveProperty('priority');
      }
    });
  });
});

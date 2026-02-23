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
// Mock the AiOrchestrator — injected via Fastify decoration
// ---------------------------------------------------------------------------

const mockOrchestrator = vi.hoisted(() => ({
  process: vi.fn(),
  processStream: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../core/middleware/company-context.js';
import { registerErrorHandler } from '../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../core/validation/index.js';
import { aiRoutesPlugin } from './ai.routes.js';
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

async function buildTestApp(opts: { withOrchestrator?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate with aiOrchestrator (mimicking the AI plugin)
  const orchestrator = opts.withOrchestrator !== false ? mockOrchestrator : null;
  app.decorate('aiOrchestrator', orchestrator as any);

  await app.register(aiRoutesPlugin, { prefix: '/ai' });
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

  // Configure permission service — STAFF and above can access ai.chat
  const aiChatPerm = { canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false };

  if (resolvedRole === 'SUPER_ADMIN') {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'ai.chat': aiChatPerm },
      fieldOverrides: {},
      accessGroups: [],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else {
    const hasAccess = ['ADMIN', 'MANAGER', 'STAFF'].includes(resolvedRole);
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: hasAccess ? { 'ai.chat': aiChatPerm } : {},
      fieldOverrides: {},
      accessGroups: hasAccess ? [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }] : [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: hasAccess ? ['system'] : [],
    });
  }
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
// Tests
// ---------------------------------------------------------------------------

describe('POST /ai/chat/message', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // AC1 — valid auth returns AI response
  it('returns AI response with valid auth (AC #1)', async () => {
    setupMocks({ role: 'STAFF' });

    const messageId = randomUUID();
    mockOrchestrator.process.mockResolvedValue({
      type: 'text',
      messageId,
      content: 'Hello! How can I help you?',
      confidence: 0.95,
      usage: { inputTokens: 50, outputTokens: 30, latencyMs: 200 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID(), content: 'Hello' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('text');
    expect(body.data.messageId).toBe(messageId);
    expect(body.data.content).toBe('Hello! How can I help you?');
    expect(body.data.confidence).toBe(0.95);
    expect(body.data.usage.inputTokens).toBe(50);
    expect(body.data.usage.outputTokens).toBe(30);

    // Verify orchestrator was called with the correct context
    expect(mockOrchestrator.process).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'chat',
        userMessage: 'Hello',
        context: expect.objectContaining({
          userId: TEST_USER_ID,
          companyId: TEST_COMPANY_ID,
          tenantId: TEST_COMPANY_ID,
          locale: 'en-GB',
        }),
      }),
    );
  });

  // AC2 — 401 without auth
  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      payload: { sessionId: randomUUID(), content: 'Hello' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // AC3 — 400 with invalid body
  it('returns 400 with invalid body (missing content)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID() },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 with invalid body (missing sessionId)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { content: 'Hello' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 with empty content string', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID(), content: '' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  // AC4 — 503 when AI is degraded
  it('returns 503 when AI is degraded (orchestrator returns error)', async () => {
    setupMocks({ role: 'STAFF' });

    mockOrchestrator.process.mockResolvedValue({
      type: 'error',
      messageId: randomUUID(),
      content: 'AI service is temporarily unavailable. Please use the traditional interface or try again later.',
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID(), content: 'Hello' },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_DEGRADED');
    expect(body.error.messageKey).toBe('ai.error.degraded');
  });

  // AC4b — 503 when orchestrator is null (AI not configured)
  it('returns 503 when AI module is not configured (orchestrator is null)', async () => {
    setupMocks({ role: 'STAFF' });

    app = await buildTestApp({ withOrchestrator: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID(), content: 'Hello' },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_DEGRADED');
    expect(body.error.message).toBe('AI service is not available');
  });

  // AC5 — 429 when quota exceeded
  it('returns 429 when quota exceeded', async () => {
    setupMocks({ role: 'STAFF' });

    mockOrchestrator.process.mockResolvedValue({
      type: 'error',
      messageId: randomUUID(),
      content: 'AI usage quota exceeded. Please try again later or contact your administrator.',
      errorCode: 'AI_QUOTA_EXCEEDED',
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID(), content: 'Hello' },
    });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_QUOTA_EXCEEDED');
    expect(body.error.messageKey).toBe('ai.error.quotaExceeded');
  });

  // RBAC — VIEWER role (no ai.chat permission) gets 403
  it('returns 403 for VIEWER role without ai.chat permission', async () => {
    setupMocks({ role: 'VIEWER' });

    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(viewerJwt),
      payload: { sessionId: randomUUID(), content: 'Hello' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // Action proposal response — structured AI response
  it('returns action_proposal response correctly', async () => {
    setupMocks({ role: 'STAFF' });

    const messageId = randomUUID();
    const actionId = randomUUID();
    mockOrchestrator.process.mockResolvedValue({
      type: 'action_proposal',
      messageId,
      content: 'I can create an invoice for you.',
      action: {
        id: actionId,
        type: 'CREATE_INVOICE',
        description: 'Create invoice for customer Acme',
        entityType: 'Invoice',
        previewData: { customerName: 'Acme Ltd', total: 500 },
        confidence: 0.92,
      },
      confidence: 0.92,
      usage: { inputTokens: 100, outputTokens: 80, latencyMs: 350 },
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/message',
      headers: authHeaders(testJwt),
      payload: { sessionId: randomUUID(), content: 'Create an invoice for Acme' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('action_proposal');
    expect(body.data.action.type).toBe('CREATE_INVOICE');
    expect(body.data.action.entityType).toBe('Invoice');
    expect(body.data.action.confidence).toBe(0.92);
  });
});

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
    aiConversation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    aiMessage: {
      findMany: vi.fn(),
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
// Mock ChatSessionService
// ---------------------------------------------------------------------------

const mockChatSessionService = vi.hoisted(() => ({
  createSession: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  generateTitle: vi.fn(),
  endSession: vi.fn(),
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

async function buildTestApp(opts: { withService?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate with aiOrchestrator (needed by existing POST /chat/message route)
  app.decorate('aiOrchestrator', null);

  // Decorate with chatSessionService
  const service = opts.withService !== false ? mockChatSessionService : null;
  app.decorate('chatSessionService', service as any);

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
// Tests: POST /ai/chat/sessions
// ---------------------------------------------------------------------------

describe('POST /ai/chat/sessions', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates session and returns 201 with valid auth', async () => {
    setupMocks({ role: 'STAFF' });

    const sessionId = randomUUID();
    const now = new Date().toISOString();
    mockChatSessionService.createSession.mockResolvedValue({
      id: sessionId,
      status: 'active',
      channel: 'web_chat',
      startedAt: now,
      title: null,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/sessions',
      headers: authHeaders(testJwt),
      payload: { channel: 'web_chat' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(sessionId);
    expect(body.data.status).toBe('active');
    expect(body.data.channel).toBe('web_chat');

    expect(mockChatSessionService.createSession).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      channel: 'web_chat',
      agentId: undefined,
    });
  });

  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/sessions',
      payload: { channel: 'web_chat' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 with invalid body (bad channel value)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/sessions',
      headers: authHeaders(testJwt),
      payload: { channel: 'invalid_channel' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('uses default channel "web_chat" when no channel provided', async () => {
    setupMocks({ role: 'STAFF' });

    const sessionId = randomUUID();
    mockChatSessionService.createSession.mockResolvedValue({
      id: sessionId,
      status: 'active',
      channel: 'web_chat',
      startedAt: new Date().toISOString(),
      title: null,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/sessions',
      headers: authHeaders(testJwt),
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    expect(mockChatSessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'web_chat' }),
    );
  });

  it('returns 503 when chatSessionService is null', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp({ withService: false });

    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat/sessions',
      headers: authHeaders(testJwt),
      payload: { channel: 'web_chat' },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_DEGRADED');
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/chat/history
// ---------------------------------------------------------------------------

describe('GET /ai/chat/history', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns paginated conversation list for current user', async () => {
    setupMocks({ role: 'STAFF' });

    const session1Id = randomUUID();
    const session2Id = randomUUID();
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 60_000).toISOString();

    mockChatSessionService.listSessions.mockResolvedValue({
      data: [
        {
          id: session1Id,
          title: 'First conversation',
          status: 'active',
          channel: 'web_chat',
          startedAt: now,
          lastMessageAt: now,
          messageCount: 5,
        },
        {
          id: session2Id,
          title: 'Second conversation',
          status: 'completed',
          channel: 'web_chat',
          startedAt: earlier,
          lastMessageAt: earlier,
          messageCount: 3,
        },
      ],
      nextCursor: null,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/chat/history',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe(session1Id);
    expect(body.data[1].id).toBe(session2Id);
    expect(body.meta.hasMore).toBe(false);

    expect(mockChatSessionService.listSessions).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      cursor: undefined,
      limit: 20,
    });
  });

  it('returns next page with cursor', async () => {
    setupMocks({ role: 'STAFF' });

    const cursorDate = new Date(Date.now() - 120_000).toISOString();
    const sessionId = randomUUID();

    mockChatSessionService.listSessions.mockResolvedValue({
      data: [
        {
          id: sessionId,
          title: 'Older conversation',
          status: 'active',
          channel: 'web_chat',
          startedAt: cursorDate,
          lastMessageAt: cursorDate,
          messageCount: 2,
        },
      ],
      nextCursor: cursorDate,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history?cursor=${encodeURIComponent(cursorDate)}&limit=1`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.hasMore).toBe(true);
    expect(body.meta.cursor).toBe(cursorDate);

    expect(mockChatSessionService.listSessions).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      cursor: cursorDate,
      limit: 1,
    });
  });

  it('returns empty array for user with no conversations', async () => {
    setupMocks({ role: 'STAFF' });

    mockChatSessionService.listSessions.mockResolvedValue({
      data: [],
      nextCursor: null,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/chat/history',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.meta.hasMore).toBe(false);
  });

  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/chat/history',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /ai/chat/history/:sessionId
// ---------------------------------------------------------------------------

describe('GET /ai/chat/history/:sessionId', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns conversation with messages', async () => {
    setupMocks({ role: 'STAFF' });

    const sessionId = randomUUID();
    const msg1Id = randomUUID();
    const msg2Id = randomUUID();
    const now = new Date().toISOString();

    mockChatSessionService.getSession.mockResolvedValue({
      id: sessionId,
      title: 'Test conversation',
      status: 'active',
      channel: 'web_chat',
      agentId: null,
      startedAt: now,
      endedAt: null,
      messages: [
        { id: msg1Id, role: 'user', content: 'Hello', confidence: null, createdAt: now },
        { id: msg2Id, role: 'assistant', content: 'Hi there!', confidence: 0.95, createdAt: now },
      ],
      nextMessageCursor: null,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history/${sessionId}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(sessionId);
    expect(body.data.title).toBe('Test conversation');
    expect(body.data.messages).toHaveLength(2);
    expect(body.data.messages[0].role).toBe('user');
    expect(body.data.messages[1].role).toBe('assistant');
    expect(body.data.nextMessageCursor).toBeNull();

    expect(mockChatSessionService.getSession).toHaveBeenCalledWith({
      sessionId,
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      messageLimit: 50,
      messageCursor: undefined,
    });
  });

  it('returns 404 for other user\'s conversation', async () => {
    setupMocks({ role: 'STAFF' });

    mockChatSessionService.getSession.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history/${randomUUID()}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for non-existent session', async () => {
    setupMocks({ role: 'STAFF' });

    mockChatSessionService.getSession.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history/${randomUUID()}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.messageKey).toBe('ai.error.sessionNotFound');
  });

  it('returns 400 for invalid sessionId format (not UUID)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/ai/chat/history/not-a-uuid',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('returns 401 without authentication', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history/${randomUUID()}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('passes custom messageLimit and messageCursor to service', async () => {
    setupMocks({ role: 'STAFF' });

    const sessionId = randomUUID();
    const cursorDate = new Date().toISOString();

    mockChatSessionService.getSession.mockResolvedValue({
      id: sessionId,
      title: null,
      status: 'active',
      channel: 'web_chat',
      agentId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      messages: [],
      nextMessageCursor: null,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history/${sessionId}?messageLimit=10&messageCursor=${encodeURIComponent(cursorDate)}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(mockChatSessionService.getSession).toHaveBeenCalledWith({
      sessionId,
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      messageLimit: 10,
      messageCursor: cursorDate,
    });
  });

  it('returns 403 for VIEWER role without ai.chat permission', async () => {
    setupMocks({ role: 'VIEWER' });

    const viewerJwt = await makeTestJwt({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/ai/chat/history/${randomUUID()}`,
      headers: authHeaders(viewerJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

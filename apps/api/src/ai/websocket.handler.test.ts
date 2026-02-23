import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import type { AiChatServerMessage } from './websocket.handler.js';
import type { AiStreamChunk } from './ai.types.js';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockVerifyAccessToken, mockPermissionService, mockPrisma, mockResolveUserRole, mockLogger } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockPermissionService: {
    hasPermission: vi.fn(),
    getEffectivePermissions: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
    getFieldVisibility: vi.fn(),
  },
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    companyProfile: {
      findUnique: vi.fn(),
    },
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
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    level: 'info',
    silent: vi.fn(),
  },
}));

// Ensure child returns the same logger shape
mockLogger.child.mockReturnValue(mockLogger);

vi.mock('../core/auth/auth.service.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

vi.mock('../core/rbac/index.js', () => ({
  permissionService: mockPermissionService,
  createPermissionGuard: vi.fn(),
}));

vi.mock('../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AiWebSocketHandler } from './websocket.handler.js';

import {
  makeTestJwt,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const OTHER_USER_ID = '00000000-0000-4000-a000-000000000002';
// OTHER_COMPANY_ID available if needed: '22222222-2222-4000-a000-222222222222'

// ---------------------------------------------------------------------------
// Mock orchestrator + chat session service factories
// ---------------------------------------------------------------------------

function createMockOrchestrator(chunks?: AiStreamChunk[]) {
  const defaultChunks: AiStreamChunk[] = [
    { type: 'content_delta', content: 'Hello ' },
    { type: 'content_delta', content: 'there!' },
    { type: 'done', usage: { inputTokens: 10, outputTokens: 5, latencyMs: 100 } },
  ];

  return {
    process: vi.fn(),
    processStream: vi.fn().mockImplementation(async function* () {
      for (const chunk of (chunks ?? defaultChunks)) {
        yield chunk;
      }
    }),
  };
}

function createMockChatSessionService() {
  return {
    createSession: vi.fn().mockResolvedValue({
      id: 'session-new',
      status: 'active',
      channel: 'web_chat',
      startedAt: new Date().toISOString(),
      title: null,
    }),
    listSessions: vi.fn(),
    getSession: vi.fn().mockResolvedValue({
      id: 'session-existing',
      title: 'Test',
      status: 'active',
      channel: 'web_chat',
      agentId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      messages: [],
      nextMessageCursor: null,
    }),
    generateTitle: vi.fn().mockResolvedValue('Auto title'),
    endSession: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let portCounter = 23000;

async function buildTestServer(opts: {
  orchestrator?: ReturnType<typeof createMockOrchestrator> | null;
  chatSessionService?: ReturnType<typeof createMockChatSessionService> | null;
} = {}): Promise<{ app: FastifyInstance; handler: AiWebSocketHandler; port: number }> {
  const port = portCounter++;
  const app = Fastify({ logger: false });

  // Decorate with mock services so the handler can access them
  const orch = opts.orchestrator !== undefined ? opts.orchestrator : createMockOrchestrator();
  const css = opts.chatSessionService !== undefined ? opts.chatSessionService : createMockChatSessionService();

  app.decorate('aiOrchestrator', orch as any);
  app.decorate('aiContextEngine', null);
  app.decorate('aiWebSocketHandler', null);
  app.decorate('chatSessionService', css as any);

  await app.listen({ port, host: '127.0.0.1' });

  // Attach websocket handler after listen (so fastify.server exists)
  const handler = new AiWebSocketHandler(app, mockLogger as any);
  handler.attach(app.server);

  return { app, handler, port };
}

function connectClient(
  port: number,
  auth: Record<string, unknown> = {},
): ClientSocket {
  return ioClient(`http://127.0.0.1:${port}/ai/chat`, {
    path: '/api/v1/ai/chat',
    transports: ['websocket'],
    auth,
    autoConnect: true,
    reconnection: false,
    timeout: 3000,
  });
}

/** Helper: collect server messages until a predicate is satisfied or timeout */
function collectMessages(
  client: ClientSocket,
  predicate: (msgs: AiChatServerMessage[]) => boolean,
  timeoutMs = 5000,
): Promise<AiChatServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: AiChatServerMessage[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms. Collected ${messages.length} messages: ${JSON.stringify(messages)}`));
    }, timeoutMs);

    client.on('chat:response', (msg: AiChatServerMessage) => {
      messages.push(msg);
      if (predicate(messages)) {
        clearTimeout(timer);
        resolve(messages);
      }
    });
  });
}

/** Helper: wait for socket connection */
function waitForConnect(client: ClientSocket, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (client.connected) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error('Connection timed out')), timeoutMs);
    client.on('connect', () => { clearTimeout(timer); resolve(); });
    client.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Helper: wait for socket connection error */
function waitForConnectError(client: ClientSocket, timeoutMs = 5000): Promise<Error> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Expected connect_error but none received')), timeoutMs);
    client.on('connect_error', (err) => { clearTimeout(timer); resolve(err); });
    client.on('connect', () => { clearTimeout(timer); reject(new Error('Expected error but got successful connection')); });
  });
}

// ---------------------------------------------------------------------------
// Auth setup helpers
// ---------------------------------------------------------------------------

function setupValidAuth() {
  mockVerifyAccessToken.mockResolvedValue({
    sub: TEST_USER_ID,
    tenantId: TEST_COMPANY_ID,
    role: 'STAFF',
    enabledModules: ['SYSTEM'],
  });
  // Company context validation mocks (mirrors company-context middleware)
  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({
    isActive: true,
  });
  mockResolveUserRole.mockResolvedValue('STAFF');
  mockPermissionService.hasPermission.mockResolvedValue(true);
}

// setupAuthForUser available if needed for future cross-user tests

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

let testJwt: string;
let expiredJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt({ role: 'STAFF' });
  // Create an expired JWT for testing
  const { SignJWT } = await import('jose');
  expiredJwt = await new SignJWT({
    tenantId: TEST_COMPANY_ID,
    role: 'STAFF',
    enabledModules: ['SYSTEM'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(TEST_USER_ID)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expired 1 hour ago
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiWebSocketHandler', () => {
  let app: FastifyInstance;
  let handler: AiWebSocketHandler;
  let port: number;
  let client: ClientSocket;

  afterEach(async () => {
    // Clean up client
    if (client?.connected) {
      client.disconnect();
    }
    client?.removeAllListeners();

    // Clean up server
    if (handler) {
      await handler.close();
    }
    if (app) {
      await app.close();
    }
  });

  // ─── Test 1: Valid JWT → authenticated successfully ──────────────────────

  it('connects with valid JWT and authenticates successfully', async () => {
    setupValidAuth();
    ({ app, handler, port } = await buildTestServer());

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });

    await waitForConnect(client);

    expect(client.connected).toBe(true);
    expect(mockVerifyAccessToken).toHaveBeenCalledWith(testJwt);
    expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
      mockPrisma,
      TEST_USER_ID,
      TEST_COMPANY_ID,
      'STAFF',
      'ai.chat',
      'view',
    );
  });

  // ─── Test 2: No JWT → rejected with AUTH_REQUIRED ────────────────────────

  it('rejects connection without JWT with AUTH_REQUIRED', async () => {
    ({ app, handler, port } = await buildTestServer());

    client = connectClient(port, { companyId: TEST_COMPANY_ID }); // No token

    const err = await waitForConnectError(client);

    expect(err.message).toContain('Authentication required');
    expect((err as any).data?.code).toBe('AUTH_REQUIRED');
    expect(client.connected).toBe(false);
  });

  // ─── Test 3: Expired JWT → rejected ──────────────────────────────────────

  it('rejects connection with expired JWT', async () => {
    // verifyAccessToken will throw for expired tokens
    mockVerifyAccessToken.mockRejectedValue(new Error('JWT expired'));
    ({ app, handler, port } = await buildTestServer());

    client = connectClient(port, { token: expiredJwt, companyId: TEST_COMPANY_ID });

    const err = await waitForConnectError(client);

    expect(err.message).toContain('Authentication required');
    expect((err as any).data?.code).toBe('AUTH_REQUIRED');
    expect(client.connected).toBe(false);
  });

  // ─── Test 4: Message → receives stream_chunk events + stream_end ────────

  it('sends message and receives stream_chunk events followed by stream_end', async () => {
    setupValidAuth();
    ({ app, handler, port } = await buildTestServer());

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    const messagesPromise = collectMessages(
      client,
      (msgs) => msgs.some((m) => m.type === 'stream_end'),
    );

    client.emit('chat:message', {
      type: 'message',
      sessionId: 'session-existing',
      content: 'What is ERP?',
    });

    const messages = await messagesPromise;

    // Should receive stream_chunk events followed by stream_end
    const chunks = messages.filter((m) => m.type === 'stream_chunk');
    const ends = messages.filter((m) => m.type === 'stream_end');

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(ends).toHaveLength(1);

    // Verify chunk content
    expect(chunks[0]!.content).toBe('Hello ');
    expect(chunks[1]!.content).toBe('there!');

    // Verify stream_end has usage
    expect(ends[0]!.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
    });

    // All messages should have the sessionId
    for (const msg of messages) {
      expect(msg.sessionId).toBe('session-existing');
    }
  });

  // ─── Test 5: Empty sessionId → auto-creates session ──────────────────────

  it('auto-creates session when sessionId is empty and returns sessionId', async () => {
    setupValidAuth();
    const mockCss = createMockChatSessionService();
    mockCss.createSession.mockResolvedValue({
      id: 'auto-session-id',
      status: 'active',
      channel: 'web_chat',
      startedAt: new Date().toISOString(),
      title: null,
    });

    ({ app, handler, port } = await buildTestServer({ chatSessionService: mockCss }));

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    const messagesPromise = collectMessages(
      client,
      (msgs) => msgs.some((m) => m.type === 'stream_end'),
    );

    // Send message with no sessionId (empty string triggers auto-create)
    client.emit('chat:message', {
      type: 'message',
      sessionId: '',
      content: 'Start a new conversation',
    });

    const messages = await messagesPromise;

    // Verify session was auto-created
    expect(mockCss.createSession).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      channel: 'web_chat',
    });

    // All response messages should carry the new auto-created sessionId
    for (const msg of messages) {
      expect(msg.sessionId).toBe('auto-session-id');
    }

    // Title should have been auto-generated with userId + companyId scoping
    expect(mockCss.generateTitle).toHaveBeenCalledWith('auto-session-id', 'Start a new conversation', TEST_USER_ID, TEST_COMPANY_ID);
  });

  // ─── Test 6: Existing sessionId → uses existing session ──────────────────

  it('uses existing session when valid sessionId is provided', async () => {
    setupValidAuth();
    const mockCss = createMockChatSessionService();
    mockCss.getSession.mockResolvedValue({
      id: 'my-session-id',
      title: 'Existing',
      status: 'active',
      channel: 'web_chat',
      agentId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      messages: [],
      nextMessageCursor: null,
    });

    ({ app, handler, port } = await buildTestServer({ chatSessionService: mockCss }));

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    const messagesPromise = collectMessages(
      client,
      (msgs) => msgs.some((m) => m.type === 'stream_end'),
    );

    client.emit('chat:message', {
      type: 'message',
      sessionId: 'my-session-id',
      content: 'Continue conversation',
    });

    const messages = await messagesPromise;

    // Should NOT create a new session
    expect(mockCss.createSession).not.toHaveBeenCalled();

    // Should verify session ownership
    expect(mockCss.getSession).toHaveBeenCalledWith({
      sessionId: 'my-session-id',
      userId: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      messageLimit: 0,
    });

    // All messages should use the existing session ID
    for (const msg of messages) {
      expect(msg.sessionId).toBe('my-session-id');
    }

    // Should NOT auto-generate title for existing session
    expect(mockCss.generateTitle).not.toHaveBeenCalled();
  });

  // ─── Test 7: Another user's sessionId → SESSION_NOT_FOUND error ──────────

  it('returns SESSION_NOT_FOUND for another user\'s session', async () => {
    setupValidAuth();
    const mockCss = createMockChatSessionService();
    // getSession returns null when session doesn't belong to the requesting user
    mockCss.getSession.mockResolvedValue(null);

    ({ app, handler, port } = await buildTestServer({ chatSessionService: mockCss }));

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    const messagesPromise = collectMessages(
      client,
      (msgs) => msgs.some((m) => m.type === 'error'),
    );

    client.emit('chat:message', {
      type: 'message',
      sessionId: 'other-users-session',
      content: 'Try to access',
    });

    const messages = await messagesPromise;
    const errorMsg = messages.find((m) => m.type === 'error');

    expect(errorMsg).toBeDefined();
    expect(errorMsg!.error!.code).toBe('SESSION_NOT_FOUND');
    expect(errorMsg!.sessionId).toBe('other-users-session');
  });

  // ─── Test 8: Client disconnect mid-stream → graceful handling ────────────

  it('handles client disconnect mid-stream gracefully', async () => {
    setupValidAuth();

    // Create a slow orchestrator that yields chunks with delays
    const slowOrchestrator = {
      process: vi.fn(),
      processStream: vi.fn().mockImplementation(async function* () {
        yield { type: 'content_delta', content: 'First chunk' } as AiStreamChunk;
        // Add a delay to allow disconnect to happen
        await new Promise((resolve) => setTimeout(resolve, 200));
        yield { type: 'content_delta', content: 'Second chunk' } as AiStreamChunk;
        await new Promise((resolve) => setTimeout(resolve, 200));
        yield { type: 'done', usage: { inputTokens: 5, outputTokens: 3, latencyMs: 50 } } as AiStreamChunk;
      }),
    };

    ({ app, handler, port } = await buildTestServer({ orchestrator: slowOrchestrator }));

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    // Send message, then disconnect after receiving first chunk
    let receivedFirst = false;
    client.on('chat:response', (msg: AiChatServerMessage) => {
      if (msg.type === 'stream_chunk' && !receivedFirst) {
        receivedFirst = true;
        // Disconnect mid-stream
        client.disconnect();
      }
    });

    client.emit('chat:message', {
      type: 'message',
      sessionId: 'session-existing',
      content: 'Disconnect test',
    });

    // Wait for processing to complete on the server side
    await new Promise((resolve) => setTimeout(resolve, 800));

    // The server should not have crashed — verify by checking handler is still functional
    expect(handler.getServer()).not.toBeNull();
    // processStream was called (even if client disconnected)
    expect(slowOrchestrator.processStream).toHaveBeenCalled();
  });

  // ─── Test 9: Server shutdown → all sockets disconnected cleanly ──────────

  it('disconnects all sockets on server shutdown', async () => {
    setupValidAuth();
    ({ app, handler, port } = await buildTestServer());

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    expect(client.connected).toBe(true);

    // Track disconnect
    const disconnectPromise = new Promise<string>((resolve) => {
      client.on('disconnect', (reason) => resolve(reason));
    });

    // Close the handler (simulates server shutdown)
    await handler.close();

    const reason = await disconnectPromise;

    // Socket.io reports various close reasons, all are valid
    expect(['io server disconnect', 'transport close', 'io client disconnect']).toContain(reason);
  });

  // ─── Test 10: AI orchestrator unavailable → AI_DEGRADED error ────────────

  it('returns AI_DEGRADED error when orchestrator is unavailable', async () => {
    setupValidAuth();

    // Set orchestrator to null (AI module not initialized)
    ({ app, handler, port } = await buildTestServer({ orchestrator: null }));

    client = connectClient(port, { token: testJwt, companyId: TEST_COMPANY_ID });
    await waitForConnect(client);

    const messagesPromise = collectMessages(
      client,
      (msgs) => msgs.some((m) => m.type === 'error'),
    );

    client.emit('chat:message', {
      type: 'message',
      sessionId: 'session-existing',
      content: 'Try to chat',
    });

    const messages = await messagesPromise;
    const errorMsg = messages.find((m) => m.type === 'error');

    expect(errorMsg).toBeDefined();
    expect(errorMsg!.error!.code).toBe('AI_DEGRADED');
    expect(errorMsg!.error!.message).toContain('not available');
  });

  // ─── Test 11: Multiple concurrent clients → no message leakage ───────────

  it('does not leak messages between concurrent users', async () => {
    // Set up auth to differentiate users by token
    mockVerifyAccessToken.mockImplementation(async (token: string) => {
      if (token === 'token-user-a') {
        return { sub: TEST_USER_ID, tenantId: TEST_COMPANY_ID, role: 'STAFF', enabledModules: ['SYSTEM'] };
      }
      return { sub: OTHER_USER_ID, tenantId: TEST_COMPANY_ID, role: 'STAFF', enabledModules: ['SYSTEM'] };
    });
    // Company context validation mocks
    mockPrisma.user.findUnique.mockResolvedValue({ companyId: TEST_COMPANY_ID, isActive: true });
    mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
    mockResolveUserRole.mockResolvedValue('STAFF');
    mockPermissionService.hasPermission.mockResolvedValue(true);

    // Create orchestrator that echoes back different content per user
    const orchestrator = {
      process: vi.fn(),
      processStream: vi.fn().mockImplementation(async function* (req: any) {
        const userId = req.context.userId;
        const content = userId === TEST_USER_ID ? 'Response for User A' : 'Response for User B';
        yield { type: 'content_delta', content } as AiStreamChunk;
        yield { type: 'done', usage: { inputTokens: 5, outputTokens: 3, latencyMs: 50 } } as AiStreamChunk;
      }),
    };

    const mockCss = createMockChatSessionService();
    // Return different sessions based on which user is querying
    mockCss.getSession.mockResolvedValue({
      id: 'shared-session',
      title: 'Test',
      status: 'active',
      channel: 'web_chat',
      agentId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      messages: [],
      nextMessageCursor: null,
    });

    ({ app, handler, port } = await buildTestServer({ orchestrator, chatSessionService: mockCss }));

    // Connect two clients as different users
    const clientA = connectClient(port, { token: 'token-user-a', companyId: TEST_COMPANY_ID });
    const clientB = connectClient(port, { token: 'token-user-b', companyId: TEST_COMPANY_ID });

    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    // Collect messages for both clients
    const msgsA = collectMessages(clientA, (msgs) => msgs.some((m) => m.type === 'stream_end'));
    const msgsB = collectMessages(clientB, (msgs) => msgs.some((m) => m.type === 'stream_end'));

    // Both send messages at the same time
    clientA.emit('chat:message', {
      type: 'message',
      sessionId: 'shared-session',
      content: 'Hello from A',
    });

    clientB.emit('chat:message', {
      type: 'message',
      sessionId: 'shared-session',
      content: 'Hello from B',
    });

    const [messagesA, messagesB] = await Promise.all([msgsA, msgsB]);

    // User A should only see "Response for User A"
    const chunksA = messagesA.filter((m) => m.type === 'stream_chunk');
    expect(chunksA.length).toBeGreaterThanOrEqual(1);
    expect(chunksA[0]!.content).toBe('Response for User A');

    // User B should only see "Response for User B"
    const chunksB = messagesB.filter((m) => m.type === 'stream_chunk');
    expect(chunksB.length).toBeGreaterThanOrEqual(1);
    expect(chunksB[0]!.content).toBe('Response for User B');

    // No cross-contamination
    for (const msg of messagesA) {
      if (msg.type === 'stream_chunk') {
        expect(msg.content).not.toContain('User B');
      }
    }
    for (const msg of messagesB) {
      if (msg.type === 'stream_chunk') {
        expect(msg.content).not.toContain('User A');
      }
    }

    // Clean up extra client
    clientA.disconnect();
    clientB.disconnect();
    clientA.removeAllListeners();
    clientB.removeAllListeners();
    // Set client to a disconnected reference so afterEach doesn't try again
    client = clientA;
  });
});

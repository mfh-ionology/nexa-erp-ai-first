import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

const mockNamespace = {
  use: vi.fn(),
  on: vi.fn(),
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
};

vi.mock('socket.io', () => {
  class MockSocketServer {
    of = vi.fn().mockReturnValue(mockNamespace);
    close = vi.fn((cb: () => void) => cb());
  }
  return { Server: MockSocketServer };
});

const mockVerifyAccessToken = vi.fn();
vi.mock('../../../core/auth/auth.service.js', () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

// Import after mocks
import {
  NotificationWebSocketHandler,
  pushNotificationToUser,
  pushUnreadCountToUser,
} from './notification.websocket.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440002';

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as any;
}

function mockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: `socket-${Math.random().toString(36).slice(2, 8)}`,
    handshake: {
      auth: { token: 'valid-jwt-token' },
      query: {},
    },
    data: {},
    join: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

/**
 * Extract the auth middleware registered via namespace.use() and
 * the connection handler registered via namespace.on('connection', ...).
 */
function extractHandlers() {
  const authMiddleware = mockNamespace.use.mock.calls[0]?.[0] as
    | ((socket: any, next: (err?: Error) => void) => Promise<void>)
    | undefined;

  const connectionCall = mockNamespace.on.mock.calls.find(
    (call: any[]) => call[0] === 'connection',
  );
  const connectionHandler = connectionCall?.[1] as ((socket: any) => void) | undefined;

  return { authMiddleware, connectionHandler };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let handler: NotificationWebSocketHandler;
let logger: ReturnType<typeof mockLogger>;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock namespace methods
  mockNamespace.use.mockClear();
  mockNamespace.on.mockClear();
  mockNamespace.to.mockClear().mockReturnThis();
  mockNamespace.emit.mockClear();

  logger = mockLogger();
  handler = new NotificationWebSocketHandler(logger);
  handler.attach({} /* mock httpServer */);
});

afterEach(async () => {
  await handler.close();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationWebSocketHandler', () => {
  describe('authentication middleware', () => {
    it('should reject connections without a token', async () => {
      const { authMiddleware } = extractHandlers();
      expect(authMiddleware).toBeDefined();

      const socket = mockSocket({
        handshake: { auth: {}, query: {} },
      });
      const next = vi.fn();

      await authMiddleware!(socket, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Authentication required' }),
      );
    });

    it('should reject connections with an invalid token', async () => {
      const { authMiddleware } = extractHandlers();
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      const socket = mockSocket();
      const next = vi.fn();

      await authMiddleware!(socket, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Authentication required' }),
      );
    });

    it('should reject tokens with missing sub claim', async () => {
      const { authMiddleware } = extractHandlers();
      mockVerifyAccessToken.mockResolvedValue({
        sub: '',
        tenantId: TENANT_ID,
      });

      const socket = mockSocket();
      const next = vi.fn();

      await authMiddleware!(socket, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Authentication required' }),
      );
    });

    it('should reject tokens with missing tenantId claim', async () => {
      const { authMiddleware } = extractHandlers();
      mockVerifyAccessToken.mockResolvedValue({
        sub: USER_ID,
        tenantId: '',
      });

      const socket = mockSocket();
      const next = vi.fn();

      await authMiddleware!(socket, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Authentication required' }),
      );
    });

    it('should accept valid JWT and attach user data', async () => {
      const { authMiddleware } = extractHandlers();
      mockVerifyAccessToken.mockResolvedValue({
        sub: USER_ID,
        tenantId: TENANT_ID,
      });

      const socket = mockSocket();
      const next = vi.fn();

      await authMiddleware!(socket, next);

      expect(next).toHaveBeenCalledWith(); // no error
      expect(socket.data).toEqual({
        userId: USER_ID,
        tenantId: TENANT_ID,
      });
    });

    it('should accept token from query parameter fallback', async () => {
      const { authMiddleware } = extractHandlers();
      mockVerifyAccessToken.mockResolvedValue({
        sub: USER_ID,
        tenantId: TENANT_ID,
      });

      const socket = mockSocket({
        handshake: { auth: {}, query: { token: 'query-jwt-token' } },
      });
      const next = vi.fn();

      await authMiddleware!(socket, next);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith('query-jwt-token');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('connection handling', () => {
    it('should join the user-specific room on connection', () => {
      const { connectionHandler } = extractHandlers();
      expect(connectionHandler).toBeDefined();

      const socket = mockSocket();
      socket.data = { userId: USER_ID, tenantId: TENANT_ID };

      connectionHandler!(socket);

      expect(socket.join).toHaveBeenCalledWith(`user:${USER_ID}`);
    });

    it('should track socket in connectedSockets map', () => {
      const { connectionHandler } = extractHandlers();

      const socket = mockSocket();
      socket.data = { userId: USER_ID, tenantId: TENANT_ID };

      connectionHandler!(socket);

      expect(handler.getConnectedUserCount()).toBe(1);
    });

    it('should clean up socket on disconnect', () => {
      const { connectionHandler } = extractHandlers();

      const socket = mockSocket();
      socket.data = { userId: USER_ID, tenantId: TENANT_ID };

      connectionHandler!(socket);
      expect(handler.getConnectedUserCount()).toBe(1);

      // Extract disconnect handler
      const disconnectCall = (socket.on as any).mock.calls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'disconnect',
      );
      expect(disconnectCall).toBeDefined();

      const disconnectHandler = disconnectCall[1];
      disconnectHandler('client namespace disconnect');

      expect(handler.getConnectedUserCount()).toBe(0);
    });

    it('should support multi-tab: track multiple sockets per user', () => {
      const { connectionHandler } = extractHandlers();

      const socket1 = mockSocket();
      socket1.data = { userId: USER_ID, tenantId: TENANT_ID };

      const socket2 = mockSocket();
      socket2.data = { userId: USER_ID, tenantId: TENANT_ID };

      connectionHandler!(socket1);
      connectionHandler!(socket2);

      // Still one user
      expect(handler.getConnectedUserCount()).toBe(1);

      // Disconnect first socket
      const disconnectHandler1 = (socket1.on as any).mock.calls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'disconnect',
      )[1];
      disconnectHandler1('client namespace disconnect');

      // User still connected (second tab)
      expect(handler.getConnectedUserCount()).toBe(1);

      // Disconnect second socket
      const disconnectHandler2 = (socket2.on as any).mock.calls.find(
        (call: [string, (...args: unknown[]) => void]) => call[0] === 'disconnect',
      )[1];
      disconnectHandler2('client namespace disconnect');

      // User fully disconnected
      expect(handler.getConnectedUserCount()).toBe(0);
    });
  });

  describe('pushNotificationToUser', () => {
    it('should emit notification:new to the correct user room', () => {
      const notification = {
        id: 'notif-001',
        title: 'Test',
        body: 'Test body',
        priority: 'NORMAL',
        actionUrl: null,
        entityType: null,
        entityId: null,
        status: 'DELIVERED',
        createdAt: new Date().toISOString(),
      };

      handler.pushNotificationToUser(USER_ID, notification);

      expect(mockNamespace.to).toHaveBeenCalledWith(`user:${USER_ID}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith('notification:new', notification);
    });

    it('should no-op when handler is closed', async () => {
      await handler.close();

      handler.pushNotificationToUser(USER_ID, { id: 'test' });

      // No error thrown, no emit called after close
      expect(mockNamespace.to).not.toHaveBeenCalled();
    });
  });

  describe('pushUnreadCountToUser', () => {
    it('should emit notification:unread-count to the correct user room', () => {
      handler.pushUnreadCountToUser(USER_ID, 5);

      expect(mockNamespace.to).toHaveBeenCalledWith(`user:${USER_ID}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith('notification:unread-count', { count: 5 });
    });
  });

  describe('standalone push functions', () => {
    it('pushNotificationToUser should delegate to handler instance', () => {
      const notification = { id: 'notif-standalone', title: 'Standalone test' };
      pushNotificationToUser(USER_ID, notification);

      expect(mockNamespace.to).toHaveBeenCalledWith(`user:${USER_ID}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith('notification:new', notification);
    });

    it('pushUnreadCountToUser should delegate to handler instance', () => {
      pushUnreadCountToUser(USER_ID, 42);

      expect(mockNamespace.to).toHaveBeenCalledWith(`user:${USER_ID}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith('notification:unread-count', { count: 42 });
    });
  });

  describe('graceful shutdown', () => {
    it('should clear connected sockets and close server', async () => {
      const { connectionHandler } = extractHandlers();

      const socket = mockSocket();
      socket.data = { userId: USER_ID, tenantId: TENANT_ID };
      connectionHandler!(socket);

      expect(handler.getConnectedUserCount()).toBe(1);

      await handler.close();

      expect(handler.getConnectedUserCount()).toBe(0);
      expect(handler.getServer()).toBeNull();
    });
  });
});

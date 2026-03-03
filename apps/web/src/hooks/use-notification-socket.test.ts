import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';

import { useNotificationSocket } from './use-notification-socket';
import type { NotificationPayload } from './use-notification-socket';

// ── Mock Socket.io client ───────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => void;

class MockSocket {
  connected = false;
  private listeners = new Map<string, EventHandler[]>();
  io = {
    _listeners: new Map<string, EventHandler[]>(),
    on(event: string, handler: EventHandler) {
      const handlers = this._listeners.get(event) ?? [];
      handlers.push(handler);
      this._listeners.set(event, handlers);
    },
    emit(event: string, ...args: unknown[]) {
      const handlers = this._listeners.get(event) ?? [];
      for (const h of handlers) h(...args);
    },
  };

  on(event: string, handler: EventHandler) {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  removeAllListeners() {
    this.listeners.clear();
    this.io._listeners.clear();
  }

  disconnect = vi.fn(() => {
    this.connected = false;
  });

  // Test helpers
  simulateConnect() {
    this.connected = true;
    const handlers = this.listeners.get('connect') ?? [];
    for (const h of handlers) h();
  }

  simulateDisconnect() {
    this.connected = false;
    const handlers = this.listeners.get('disconnect') ?? [];
    for (const h of handlers) h();
  }

  simulateReconnect() {
    this.io.emit('reconnect');
  }

  emit(event: string, ...args: unknown[]) {
    const handlers = this.listeners.get(event) ?? [];
    for (const h of handlers) h(...args);
  }
}

let mockSocketInstance: MockSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    mockSocketInstance = new MockSocket();
    return mockSocketInstance;
  }),
}));

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'test@nexa.io', firstName: 'Test', lastName: 'User' },
    accessToken: 'test-jwt-token',
    refreshToken: null,
    activeCompanyId: 'c-1',
    permissions: null,
    isAuthenticated: true,
    isLoading: false,
    rememberMe: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useNotificationSocket', () => {
  const defaultOptions = () => ({
    onNotification: vi.fn(),
    onUnreadCount: vi.fn(),
    onReconnect: vi.fn(),
  });

  describe('connection', () => {
    it('connects with correct auth token', async () => {
      const { io: ioFn } = await import('socket.io-client');
      const opts = defaultOptions();

      renderHook(() => useNotificationSocket(opts));

      expect(ioFn).toHaveBeenCalledWith(
        expect.stringContaining('/notifications'),
        expect.objectContaining({
          path: '/api/v1/notifications/ws',
          transports: ['websocket', 'polling'],
          auth: { token: 'test-jwt-token' },
          autoConnect: true,
        }),
      );
    });

    it('sets isConnected to true on connect', () => {
      const opts = defaultOptions();
      const { result } = renderHook(() => useNotificationSocket(opts));

      expect(result.current.isConnected).toBe(false);

      act(() => {
        mockSocketInstance.simulateConnect();
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('sets isConnected to false on disconnect', () => {
      const opts = defaultOptions();
      const { result } = renderHook(() => useNotificationSocket(opts));

      act(() => {
        mockSocketInstance.simulateConnect();
      });

      expect(result.current.isConnected).toBe(true);

      act(() => {
        mockSocketInstance.simulateDisconnect();
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('does not connect when no access token', () => {
      useAuthStore.setState({ accessToken: null });
      const opts = defaultOptions();

      const { result } = renderHook(() => useNotificationSocket(opts));

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('events', () => {
    it('notification:new callback fires with payload', () => {
      const opts = defaultOptions();
      renderHook(() => useNotificationSocket(opts));

      const payload: NotificationPayload = {
        id: 'notif-1',
        title: 'New Invoice',
        body: 'Invoice INV-001 has been approved',
        priority: 'HIGH',
        actionUrl: '/finance/invoices/inv-1',
        entityType: 'Invoice',
        entityId: 'inv-1',
        status: 'DELIVERED',
        createdAt: '2026-03-03T10:00:00.000Z',
      };

      act(() => {
        mockSocketInstance.simulateConnect();
        mockSocketInstance.emit('notification:new', payload);
      });

      expect(opts.onNotification).toHaveBeenCalledWith(payload);
    });

    it('notification:unread-count callback fires with count', () => {
      const opts = defaultOptions();
      renderHook(() => useNotificationSocket(opts));

      act(() => {
        mockSocketInstance.simulateConnect();
        mockSocketInstance.emit('notification:unread-count', { count: 5 });
      });

      expect(opts.onUnreadCount).toHaveBeenCalledWith(5);
    });

    it('calls onReconnect on reconnection', () => {
      const opts = defaultOptions();
      renderHook(() => useNotificationSocket(opts));

      act(() => {
        mockSocketInstance.simulateConnect();
        mockSocketInstance.simulateReconnect();
      });

      expect(opts.onReconnect).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('disconnects on unmount', () => {
      const opts = defaultOptions();
      const { unmount } = renderHook(() => useNotificationSocket(opts));

      act(() => {
        mockSocketInstance.simulateConnect();
      });

      const socket = mockSocketInstance;
      unmount();

      expect(socket.disconnect).toHaveBeenCalled();
    });
  });
});

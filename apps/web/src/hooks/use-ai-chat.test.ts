import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useCopilotStore } from '@/stores/copilot-store';

import { useAiChat } from './use-ai-chat';

// ── Mock WebSocket ─────────────────────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];

  vi.stubGlobal('WebSocket', MockWebSocket);

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

  useCopilotStore.setState({
    isDrawerOpen: false,
    activeConversationId: 'session-1',
    isStreaming: false,
    connectionStatus: 'disconnected',
    messages: [],
    sessionMessages: {},
    sessions: [],
    isMinimised: false,
    pendingInput: '',
    currentContext: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useAiChat', () => {
  describe('connection lifecycle', () => {
    it('connects to WebSocket on mount when token is present', () => {
      renderHook(() => useAiChat());

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0]?.url).toContain('/api/v1/ai/chat');
      // Token should NOT be in the URL (security: avoids server log exposure)
      expect(MockWebSocket.instances[0]?.url).not.toContain('token=');
    });

    it('sends auth message with token on WebSocket open', () => {
      renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      const ws = MockWebSocket.instances[0]!;
      expect(ws.sent).toHaveLength(1);
      const authMsg = JSON.parse(ws.sent[0]!);
      expect(authMsg.type).toBe('auth');
      expect(authMsg.token).toBe('test-jwt-token');
    });

    it('sets connectionStatus to "connecting" then "connected" on open', () => {
      renderHook(() => useAiChat());

      expect(useCopilotStore.getState().connectionStatus).toBe('connecting');

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      expect(useCopilotStore.getState().connectionStatus).toBe('connected');
    });

    it('cleans up WebSocket on unmount', () => {
      const { unmount } = renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      unmount();

      expect(useCopilotStore.getState().connectionStatus).toBe('disconnected');
    });
  });

  describe('reconnection', () => {
    it('reconnects with exponential backoff on close', () => {
      renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      // First disconnect
      act(() => {
        MockWebSocket.instances[0]?.simulateClose();
      });

      expect(useCopilotStore.getState().connectionStatus).toBe('disconnected');
      expect(MockWebSocket.instances).toHaveLength(1); // Not yet reconnected

      // Advance past 1s backoff
      act(() => {
        vi.advanceTimersByTime(1_000);
      });

      expect(MockWebSocket.instances).toHaveLength(2); // Reconnected
    });

    it('sets status to "error" after 3 failed reconnect attempts', () => {
      renderHook(() => useAiChat());

      // Close 4 times (initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        act(() => {
          MockWebSocket.instances[i]?.simulateClose();
        });
        if (i < 3) {
          act(() => {
            vi.advanceTimersByTime(BACKOFF_BASE_MS * Math.pow(2, i));
          });
        }
      }

      expect(useCopilotStore.getState().connectionStatus).toBe('error');
    });
  });

  describe('sending messages', () => {
    it('sendMessage sends a JSON message via WebSocket', () => {
      const { result } = renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        result.current.sendMessage('Hello AI');
      });

      const ws = MockWebSocket.instances[0]!;
      // sent[0] is the auth message, sent[1] is the chat message
      expect(ws.sent).toHaveLength(2);
      const parsed = JSON.parse(ws.sent[1]!);
      expect(parsed.type).toBe('message');
      expect(parsed.content).toBe('Hello AI');
      expect(parsed.sessionId).toBe('session-1');
      // Client sends placeholder ID so server can echo it back as messageId
      expect(parsed.placeholderMessageId).toBeDefined();
      expect(typeof parsed.placeholderMessageId).toBe('string');
    });

    it('confirmAction sends action_confirm message', () => {
      const { result } = renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        result.current.confirmAction('action-42');
      });

      const ws = MockWebSocket.instances[0]!;
      // sent[0] is auth, sent[1] is the action
      const parsed = JSON.parse(ws.sent[1]!);
      expect(parsed.type).toBe('action_confirm');
      expect(parsed.actionId).toBe('action-42');
    });

    it('rejectAction sends action_reject message', () => {
      const { result } = renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        result.current.rejectAction('action-42');
      });

      const ws = MockWebSocket.instances[0]!;
      // sent[0] is auth, sent[1] is the action
      const parsed = JSON.parse(ws.sent[1]!);
      expect(parsed.type).toBe('action_reject');
      expect(parsed.actionId).toBe('action-42');
    });
  });

  describe('incoming message handling', () => {
    it('handles stream_chunk by appending to message content', () => {
      renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      // Add a streaming assistant message first
      act(() => {
        useCopilotStore.getState().addMessage({
          id: 'msg-stream',
          sessionId: 'session-1',
          role: 'assistant',
          content: 'He',
          timestamp: new Date().toISOString(),
          isStreaming: true,
        });
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateMessage({
          type: 'stream_chunk',
          messageId: 'msg-stream',
          content: 'llo',
        });
      });

      const msg = useCopilotStore.getState().messages.find((m) => m.id === 'msg-stream');
      expect(msg?.content).toBe('Hello');
    });

    it('handles stream_end by completing the streaming message', () => {
      renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        useCopilotStore.getState().addMessage({
          id: 'msg-stream',
          sessionId: 'session-1',
          role: 'assistant',
          content: 'Done',
          timestamp: new Date().toISOString(),
          isStreaming: true,
        });
        useCopilotStore.getState().setStreaming(true);
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateMessage({
          type: 'stream_end',
          messageId: 'msg-stream',
        });
      });

      const msg = useCopilotStore.getState().messages.find((m) => m.id === 'msg-stream');
      expect(msg?.isStreaming).toBe(false);
      expect(useCopilotStore.getState().isStreaming).toBe(false);
    });

    it('handles text message by adding to store', () => {
      renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        MockWebSocket.instances[0]?.simulateMessage({
          type: 'text',
          messageId: 'msg-text',
          sessionId: 'session-1',
          content: 'Here is your answer',
        });
      });

      const messages = useCopilotStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('Here is your answer');
      expect(messages[0]?.role).toBe('assistant');
    });

    it('handles error message by adding to store and stopping streaming', () => {
      renderHook(() => useAiChat());

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      act(() => {
        useCopilotStore.getState().setStreaming(true);
        MockWebSocket.instances[0]?.simulateMessage({
          type: 'error',
          error: 'Something went wrong',
        });
      });

      const messages = useCopilotStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('Something went wrong');
      expect(useCopilotStore.getState().isStreaming).toBe(false);
    });
  });

  describe('return values', () => {
    it('returns isConnected based on connectionStatus', () => {
      const { result } = renderHook(() => useAiChat());

      expect(result.current.isConnected).toBe(false);

      act(() => {
        MockWebSocket.instances[0]?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);
    });
  });
});

const BACKOFF_BASE_MS = 1_000;

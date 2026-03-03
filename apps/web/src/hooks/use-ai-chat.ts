import { useCallback, useEffect, useRef } from 'react';

import { useAuthStore } from '@/stores/auth-store';
import { useCopilotStore, type ChatMessage, type ConnectionStatus } from '@/stores/copilot-store';
import type { EntityMention } from '@/features/ai/entity-mentions/types';

// ── WebSocket message types (aligned with API contracts §3.6) ────────────────

export interface AiChatClientMessage {
  type: 'message' | 'action_confirm' | 'action_reject';
  sessionId: string;
  content?: string;
  actionId?: string;
  /** Client-generated placeholder ID so the server echoes it back as messageId */
  placeholderMessageId?: string;
  /** Structured entity mentions referenced in the message (E5b-7) */
  entityMentions?: Array<{ type: string; id: string; name: string }>;
}

export interface AiChatServerMessage {
  type: 'stream_chunk' | 'stream_end' | 'text' | 'action_proposal' | 'record_created' | 'error';
  messageId?: string;
  sessionId?: string;
  content?: string;
  actionProposal?: ChatMessage['actionProposal'];
  recordLinks?: ChatMessage['recordLinks'];
  dataCards?: ChatMessage['dataCards'];
  error?: string;
}

// ── Configuration ────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

function getWsUrl(): string {
  const base =
    import.meta.env.VITE_API_WS_URL ??
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${base}/api/v1/ai/chat`;
}

// ── Hook return type ─────────────────────────────────────────────────────────

export interface UseAiChatReturn {
  sendMessage: (content: string, mentions?: EntityMention[]) => void;
  confirmAction: (actionId: string) => void;
  rejectAction: (actionId: string) => void;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages WebSocket lifecycle for the AI chat:
 *  - Connects to `wss://{host}/api/v1/ai/chat?token={jwt}` on mount
 *  - Reconnects with exponential backoff (1s, 2s, 4s, max 30s) on disconnect
 *  - Graceful degradation: after MAX_RECONNECT_ATTEMPTS, sets status to 'error'
 *  - Dispatches incoming server messages to the copilot store
 *  - Cleans up on unmount
 */
export function useAiChat(): UseAiChatReturn {
  const accessToken = useAuthStore((s) => s.accessToken);
  const connectionStatus = useCopilotStore((s) => s.connectionStatus);
  const setConnectionStatus = useCopilotStore((s) => s.setConnectionStatus);
  const activeConversationId = useCopilotStore((s) => s.activeConversationId);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  // ── Incoming message handler ────────────────────────────────────────────
  const handleServerMessage = useCallback((data: AiChatServerMessage) => {
    const store = useCopilotStore.getState();

    switch (data.type) {
      case 'stream_chunk': {
        if (data.messageId && data.content) {
          store.appendStreamChunk(data.messageId, data.content);
        }
        break;
      }
      case 'stream_end': {
        if (data.messageId) {
          store.completeStreamingMessage(data.messageId);
          store.setStreaming(false);
        }
        break;
      }
      case 'text': {
        const msg: ChatMessage = {
          id: data.messageId ?? crypto.randomUUID(),
          sessionId: data.sessionId ?? store.activeConversationId ?? '',
          role: 'assistant',
          content: data.content ?? '',
          timestamp: new Date().toISOString(),
          recordLinks: data.recordLinks,
          dataCards: data.dataCards,
        };
        store.addMessage(msg);
        break;
      }
      case 'action_proposal': {
        const msg: ChatMessage = {
          id: data.messageId ?? crypto.randomUUID(),
          sessionId: data.sessionId ?? store.activeConversationId ?? '',
          role: 'assistant',
          content: data.content ?? '',
          timestamp: new Date().toISOString(),
          actionProposal: data.actionProposal,
        };
        store.addMessage(msg);
        break;
      }
      case 'record_created': {
        const msg: ChatMessage = {
          id: data.messageId ?? crypto.randomUUID(),
          sessionId: data.sessionId ?? store.activeConversationId ?? '',
          role: 'assistant',
          content: data.content ?? '',
          timestamp: new Date().toISOString(),
          recordLinks: data.recordLinks,
        };
        store.addMessage(msg);
        break;
      }
      case 'error': {
        const msg: ChatMessage = {
          id: data.messageId ?? crypto.randomUUID(),
          sessionId: data.sessionId ?? store.activeConversationId ?? '',
          role: 'assistant',
          content: data.error ?? data.content ?? '',
          timestamp: new Date().toISOString(),
        };
        store.addMessage(msg);
        store.setStreaming(false);
        break;
      }
    }
  }, []);

  // ── Connect / reconnect logic ───────────────────────────────────────────
  const connect = useCallback(() => {
    if (unmountedRef.current || !accessToken) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    setConnectionStatus('connecting');

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      reconnectAttemptRef.current = 0;
      // Authenticate via first message instead of URL query parameter
      // to avoid token exposure in server logs and browser history.
      ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      try {
        const data = JSON.parse(event.data as string) as AiChatServerMessage;
        handleServerMessage(data);
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onerror = () => {
      // Error is followed by onclose, so reconnection is handled there
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;

      const attempt = reconnectAttemptRef.current;
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('error');
        return;
      }

      setConnectionStatus('disconnected');
      reconnectAttemptRef.current = attempt + 1;

      const backoffMs = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, backoffMs);
    };
  }, [accessToken, setConnectionStatus, handleServerMessage]);

  // ── Lifecycle ───────────────────────────────────────────────────────────
  useEffect(() => {
    unmountedRef.current = false;

    if (accessToken) {
      connect();
    }

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, [accessToken, connect, setConnectionStatus]);

  // ── Public API ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (content: string, mentions?: EntityMention[]) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const sessionId = activeConversationId ?? '';

      // Add streaming placeholder for assistant response
      const streamingMsgId = crypto.randomUUID();
      const store = useCopilotStore.getState();
      store.addMessage({
        id: streamingMsgId,
        sessionId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      });
      store.setStreaming(true);

      const msg: AiChatClientMessage = {
        type: 'message',
        sessionId,
        content,
        placeholderMessageId: streamingMsgId,
        entityMentions:
          mentions && mentions.length > 0
            ? mentions.map((m) => ({ type: m.type, id: m.id, name: m.name }))
            : undefined,
      };
      ws.send(JSON.stringify(msg));
    },
    [activeConversationId],
  );

  const confirmAction = useCallback(
    (actionId: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const msg: AiChatClientMessage = {
        type: 'action_confirm',
        sessionId: activeConversationId ?? '',
        actionId,
      };
      ws.send(JSON.stringify(msg));
    },
    [activeConversationId],
  );

  const rejectAction = useCallback(
    (actionId: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const msg: AiChatClientMessage = {
        type: 'action_reject',
        sessionId: activeConversationId ?? '',
        actionId,
      };
      ws.send(JSON.stringify(msg));
    },
    [activeConversationId],
  );

  return {
    sendMessage,
    confirmAction,
    rejectAction,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
  };
}

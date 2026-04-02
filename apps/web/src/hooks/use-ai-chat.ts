import { useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useRouter } from '@tanstack/react-router';

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
  type:
    | 'stream_chunk'
    | 'stream_end'
    | 'text'
    | 'action_proposal'
    | 'record_created'
    | 'error'
    | 'navigate';
  messageId?: string;
  sessionId?: string;
  content?: string;
  actionProposal?: ChatMessage['actionProposal'];
  recordLinks?: ChatMessage['recordLinks'];
  dataCards?: ChatMessage['dataCards'];
  error?: string;
  /** Route path for navigate messages (e.g. '/finance/reports/profit-and-loss?fiscalYear=2025&autoRun=true') */
  route?: string;
}

// ── Configuration ────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;

function getSocketUrl(): string {
  if (import.meta.env.VITE_API_WS_URL) return import.meta.env.VITE_API_WS_URL as string;
  return window.location.origin;
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
 * Manages Socket.io lifecycle for the AI chat:
 *  - Connects to the /ai/chat namespace via Socket.io client
 *  - Auth: passes JWT token + companyId in handshake auth
 *  - Reconnects automatically (Socket.io built-in with max attempts)
 *  - Dispatches incoming server messages to the copilot store
 *  - Cleans up on unmount
 */
export function useAiChat(): UseAiChatReturn {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const permissions = useAuthStore((s) => s.permissions);
  const connectionStatus = useCopilotStore((s) => s.connectionStatus);
  const setConnectionStatus = useCopilotStore((s) => s.setConnectionStatus);
  const activeConversationId = useCopilotStore((s) => s.activeConversationId);
  const router = useRouter();

  const socketRef = useRef<Socket | null>(null);
  const unmountedRef = useRef(false);

  // Resolve company ID: activeCompanyId (set after permissions load) or from permissions directly
  const companyId = activeCompanyId ?? permissions?.companyId ?? null;

  // ── Incoming message handler ────────────────────────────────────────────
  const handleServerMessage = useCallback(
    (data: AiChatServerMessage) => {
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
          // If messageId matches an existing streaming message, update its content
          // (used when server extracts answer from structured JSON response)
          const existing = data.messageId
            ? store.messages.find((m) => m.id === data.messageId)
            : undefined;
          if (existing) {
            store.updateStreamingMessage(data.messageId!, data.content ?? '');
          } else {
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
          }
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
        case 'navigate': {
          if (data.route) {
            setTimeout(() => {
              void router.navigate({ to: data.route! });
            }, 100);
          }
          break;
        }
      }
    },
    [router],
  );

  // ── Connect / reconnect logic ───────────────────────────────────────────
  // Subscribe to auth store changes and connect when both token + companyId are available.
  // This handles the timing issue where permissions load AFTER the initial render.
  useEffect(() => {
    unmountedRef.current = false;
    console.log('[ai-chat] useEffect mounted');

    function tryConnect() {
      const {
        accessToken: token,
        activeCompanyId: cid,
        permissions: perms,
      } = useAuthStore.getState();
      // Resolve company ID from multiple sources: store state, permissions, or JWT payload
      let resolvedCompanyId = cid ?? perms?.companyId;
      if (!resolvedCompanyId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]!));
          resolvedCompanyId = payload.tenantId ?? payload.companyId;
        } catch {
          /* ignore malformed token */
        }
      }
      console.log('[ai-chat] tryConnect:', { hasToken: !!token, resolved: resolvedCompanyId });

      if (!token || !resolvedCompanyId) return;
      if (socketRef.current?.connected) return;

      // Disconnect stale socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (import.meta.env.DEV) {
        console.log('[ai-chat] Connecting to', getSocketUrl(), 'company:', resolvedCompanyId);
      }
      setConnectionStatus('connecting');

      const socket = io(`${getSocketUrl()}/ai/chat`, {
        path: '/api/v1/ai/chat',
        auth: {
          token,
          companyId: resolvedCompanyId,
        },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        timeout: 10000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (unmountedRef.current) return;
        if (import.meta.env.DEV) console.log('[ai-chat] Connected!');
        setConnectionStatus('connected');
      });

      socket.on('chat:response', (data: AiChatServerMessage) => {
        if (unmountedRef.current) return;
        handleServerMessage(data);
      });

      socket.on('connect_error', (err) => {
        if (unmountedRef.current) return;
        console.warn('[ai-chat] Socket.io connect error:', err.message);
        setConnectionStatus('disconnected');
      });

      socket.on('disconnect', (reason) => {
        if (unmountedRef.current) return;
        if (reason === 'io server disconnect') {
          setConnectionStatus('error');
        } else {
          setConnectionStatus('disconnected');
        }
      });

      socket.io.on('reconnect_failed', () => {
        if (unmountedRef.current) return;
        setConnectionStatus('error');
      });
    }

    // Try immediately (may succeed if permissions already loaded)
    tryConnect();

    // Subscribe to auth store — re-try when token/permissions change
    const unsubscribe = useAuthStore.subscribe(tryConnect);

    return () => {
      unmountedRef.current = true;
      unsubscribe();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, [setConnectionStatus, handleServerMessage]);

  // ── Public API ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (content: string, mentions?: EntityMention[]) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;

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
      socket.emit('chat:message', msg);
    },
    [activeConversationId],
  );

  const confirmAction = useCallback(
    (actionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;

      const msg: AiChatClientMessage = {
        type: 'action_confirm',
        sessionId: activeConversationId ?? '',
        actionId,
      };
      socket.emit('chat:message', msg);
    },
    [activeConversationId],
  );

  const rejectAction = useCallback(
    (actionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;

      const msg: AiChatClientMessage = {
        type: 'action_reject',
        sessionId: activeConversationId ?? '',
        actionId,
      };
      socket.emit('chat:message', msg);
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

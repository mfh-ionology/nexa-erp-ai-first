import { create } from 'zustand';

// ── Chat message types (aligned with AiChatServerMessage WS contract §2.6) ──

export interface ChatMessageAction {
  id: string;
  label: string;
  /** i18n key for the label */
  labelKey?: string;
  type: 'navigate' | 'execute' | 'confirm';
}

export interface ChatRecordLink {
  entityType: string;
  entityId: string;
  displayRef: string; // e.g., "INV-000042"
}

export interface ActionProposal {
  id: string;
  type: string; // 'CREATE_INVOICE', 'SEND_EMAIL', etc.
  description: string;
  entityType: string;
  previewData: Record<string, unknown>;
  confidence: number; // 0.0 - 1.0
}

export interface DataCardMetric {
  label: string;
  labelKey?: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export interface DataCard {
  id: string;
  title: string;
  titleKey?: string;
  metrics: DataCardMetric[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  /** Timestamp ISO string */
  timestamp: string;
  /** Whether the message is currently being streamed */
  isStreaming?: boolean;
  /** Inline action buttons in AI messages */
  actions?: ChatMessageAction[];
  /** Record links in AI messages */
  recordLinks?: ChatRecordLink[];
  /** Action proposals requiring confirmation (BR-COM-013) */
  actionProposal?: ActionProposal;
  /** Inline data cards in AI messages */
  dataCards?: DataCard[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface CopilotPageContext {
  pageRoute: string;
  entityType?: string;
  entityId?: string;
}

/** WebSocket connection status (Task 1.5) */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── Store interface ──────────────────────────────────────────────────────────

export interface CopilotState {
  // Existing state
  isDrawerOpen: boolean;
  activeConversationId: string | null;
  isStreaming: boolean;

  // Connection status (Task 1.5)
  connectionStatus: ConnectionStatus;

  // Chat state
  messages: ChatMessage[];
  /** Per-session message cache: sessionId → messages */
  sessionMessages: Record<string, ChatMessage[]>;
  sessions: ChatSession[];
  isMinimised: boolean;
  pendingInput: string;
  currentContext: CopilotPageContext | null;

  // Existing actions
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setActiveConversation: (id: string | null) => void;
  setStreaming: (streaming: boolean) => void;

  // Connection actions
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Chat actions
  addMessage: (message: ChatMessage) => void;
  appendStreamChunk: (messageId: string, chunk: string) => void;
  updateStreamingMessage: (messageId: string, content: string) => void;
  completeStreamingMessage: (messageId: string) => void;
  setSessions: (sessions: ChatSession[]) => void;
  createSession: (session: ChatSession) => void;
  /** Switch to a session, saving current messages and loading the target session's messages */
  switchToSession: (sessionId: string) => void;
  setPendingInput: (input: string) => void;
  setMinimised: (minimised: boolean) => void;
  setCurrentContext: (context: CopilotPageContext | null) => void;
  clearMessages: () => void;
  /**
   * Submit a user message and add a placeholder AI response.
   * Centralises the pattern used by CopilotInput, QuickPrompts, and UnifiedSearch.
   */
  submitUserMessage: (content: string) => void;
}

export const useCopilotStore = create<CopilotState>()((set, get) => ({
  // Existing state
  isDrawerOpen: false,
  activeConversationId: null,
  isStreaming: false,

  // Connection status
  connectionStatus: 'disconnected',

  // Chat state
  messages: [],
  sessionMessages: {},
  sessions: [],
  isMinimised: false,
  pendingInput: '',
  currentContext: null,

  // Existing actions
  openDrawer: () => set({ isDrawerOpen: true }),

  closeDrawer: () => set({ isDrawerOpen: false }),

  toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  // Connection actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Chat actions
  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  appendStreamChunk: (messageId, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + chunk } : m,
      ),
    })),

  updateStreamingMessage: (messageId, content) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content } : m,
      ),
    })),

  completeStreamingMessage: (messageId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, isStreaming: false } : m,
      ),
    })),

  setSessions: (sessions) => set({ sessions }),

  createSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),

  switchToSession: (sessionId) => {
    const state = get();
    const currentId = state.activeConversationId;

    // Save current messages under the current session (if any)
    const updatedCache = { ...state.sessionMessages };
    if (currentId) {
      updatedCache[currentId] = state.messages;
    }

    // Load messages for the target session (or empty array if none cached)
    const targetMessages = updatedCache[sessionId] ?? [];

    set({
      sessionMessages: updatedCache,
      messages: targetMessages,
      activeConversationId: sessionId,
    });
  },

  setPendingInput: (input) => set({ pendingInput: input }),

  setMinimised: (minimised) => set({ isMinimised: minimised }),

  setCurrentContext: (context) => set({ currentContext: context }),

  clearMessages: () => set({ messages: [] }),

  submitUserMessage: (content) => {
    const state = get();
    if (!content.trim() || state.isStreaming) return;

    const sessionId = state.activeConversationId ?? '';

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMessage] }));

    // Open drawer if closed
    if (!state.isDrawerOpen) {
      set({ isDrawerOpen: true });
    }

    // MVP placeholder: shows a static AI response so the user gets feedback.
    // TODO(E7): Remove this placeholder once useAiChat hook is wired into
    // the component tree. The hook's sendMessage() creates its own streaming
    // placeholder, so keeping both would produce duplicate assistant messages.
    setTimeout(() => {
      const placeholderMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content:
          'I received your message. AI responses will be connected when the AI backend is integrated.',
        timestamp: new Date().toISOString(),
      };
      get().addMessage(placeholderMessage);
    }, 500);
  },
}));

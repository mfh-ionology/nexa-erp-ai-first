import { describe, it, expect, beforeEach } from 'vitest';

import {
  useCopilotStore,
  type ChatMessage,
  type ChatSession,
} from './copilot-store';

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  sessionId: 'session-1',
  role: 'user',
  content: 'Hello',
  timestamp: '2026-02-23T12:00:00Z',
  ...overrides,
});

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 'session-1',
  title: 'Test Chat',
  lastMessageAt: '2026-02-23T12:00:00Z',
  messageCount: 1,
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useCopilotStore', () => {
  beforeEach(() => {
    useCopilotStore.setState({
      isDrawerOpen: false,
      activeConversationId: null,
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

  describe('openDrawer / closeDrawer / toggleDrawer', () => {
    it('openDrawer sets isDrawerOpen to true', () => {
      useCopilotStore.getState().openDrawer();
      expect(useCopilotStore.getState().isDrawerOpen).toBe(true);
    });

    it('closeDrawer sets isDrawerOpen to false', () => {
      useCopilotStore.setState({ isDrawerOpen: true });
      useCopilotStore.getState().closeDrawer();
      expect(useCopilotStore.getState().isDrawerOpen).toBe(false);
    });

    it('toggleDrawer toggles isDrawerOpen', () => {
      expect(useCopilotStore.getState().isDrawerOpen).toBe(false);
      useCopilotStore.getState().toggleDrawer();
      expect(useCopilotStore.getState().isDrawerOpen).toBe(true);
      useCopilotStore.getState().toggleDrawer();
      expect(useCopilotStore.getState().isDrawerOpen).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('appends to messages array', () => {
      const msg = makeMessage();
      useCopilotStore.getState().addMessage(msg);
      expect(useCopilotStore.getState().messages).toEqual([msg]);
    });

    it('preserves existing messages', () => {
      const msg1 = makeMessage({ id: 'msg-1' });
      const msg2 = makeMessage({ id: 'msg-2', content: 'World' });
      useCopilotStore.getState().addMessage(msg1);
      useCopilotStore.getState().addMessage(msg2);
      expect(useCopilotStore.getState().messages).toHaveLength(2);
      expect(useCopilotStore.getState().messages[0]).toEqual(msg1);
      expect(useCopilotStore.getState().messages[1]).toEqual(msg2);
    });
  });

  describe('updateStreamingMessage', () => {
    it('updates content of specified message', () => {
      const msg = makeMessage({
        id: 'msg-1',
        role: 'assistant',
        isStreaming: true,
        content: 'He',
      });
      useCopilotStore.setState({ messages: [msg] });

      useCopilotStore.getState().updateStreamingMessage('msg-1', 'Hello world');
      expect(useCopilotStore.getState().messages[0]?.content).toBe(
        'Hello world',
      );
    });

    it('does not affect other messages', () => {
      const msg1 = makeMessage({ id: 'msg-1', content: 'Original' });
      const msg2 = makeMessage({
        id: 'msg-2',
        role: 'assistant',
        isStreaming: true,
        content: 'Str',
      });
      useCopilotStore.setState({ messages: [msg1, msg2] });

      useCopilotStore
        .getState()
        .updateStreamingMessage('msg-2', 'Streaming...');
      expect(useCopilotStore.getState().messages[0]?.content).toBe('Original');
      expect(useCopilotStore.getState().messages[1]?.content).toBe(
        'Streaming...',
      );
    });
  });

  describe('completeStreamingMessage', () => {
    it('sets isStreaming to false', () => {
      const msg = makeMessage({
        id: 'msg-1',
        role: 'assistant',
        isStreaming: true,
      });
      useCopilotStore.setState({ messages: [msg] });

      useCopilotStore.getState().completeStreamingMessage('msg-1');
      expect(useCopilotStore.getState().messages[0]?.isStreaming).toBe(false);
    });
  });

  describe('clearMessages', () => {
    it('empties the messages array', () => {
      useCopilotStore.setState({
        messages: [makeMessage(), makeMessage({ id: 'msg-2' })],
      });
      useCopilotStore.getState().clearMessages();
      expect(useCopilotStore.getState().messages).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('adds to sessions array', () => {
      const session = makeSession();
      useCopilotStore.getState().createSession(session);
      expect(useCopilotStore.getState().sessions).toEqual([session]);
    });

    it('prepends new sessions', () => {
      const session1 = makeSession({ id: 's-1', title: 'First' });
      useCopilotStore.setState({ sessions: [session1] });

      const session2 = makeSession({ id: 's-2', title: 'Second' });
      useCopilotStore.getState().createSession(session2);

      expect(useCopilotStore.getState().sessions[0]?.id).toBe('s-2');
      expect(useCopilotStore.getState().sessions[1]?.id).toBe('s-1');
    });
  });

  describe('setSessions', () => {
    it('replaces sessions array', () => {
      const sessions = [
        makeSession({ id: 'a' }),
        makeSession({ id: 'b' }),
      ];
      useCopilotStore.getState().setSessions(sessions);
      expect(useCopilotStore.getState().sessions).toEqual(sessions);
    });
  });

  describe('setMinimised', () => {
    it('toggles minimised state', () => {
      expect(useCopilotStore.getState().isMinimised).toBe(false);
      useCopilotStore.getState().setMinimised(true);
      expect(useCopilotStore.getState().isMinimised).toBe(true);
      useCopilotStore.getState().setMinimised(false);
      expect(useCopilotStore.getState().isMinimised).toBe(false);
    });
  });

  describe('setCurrentContext', () => {
    it('updates context', () => {
      const context = {
        pageRoute: '/ar/invoices',
        entityType: 'customerInvoice',
      };
      useCopilotStore.getState().setCurrentContext(context);
      expect(useCopilotStore.getState().currentContext).toEqual(context);
    });

    it('clears context when set to null', () => {
      useCopilotStore.setState({
        currentContext: { pageRoute: '/ar/invoices' },
      });
      useCopilotStore.getState().setCurrentContext(null);
      expect(useCopilotStore.getState().currentContext).toBeNull();
    });
  });

  describe('setPendingInput', () => {
    it('updates pendingInput', () => {
      useCopilotStore.getState().setPendingInput('hello');
      expect(useCopilotStore.getState().pendingInput).toBe('hello');
    });
  });

  describe('setActiveConversation', () => {
    it('sets active conversation id', () => {
      useCopilotStore.getState().setActiveConversation('session-1');
      expect(useCopilotStore.getState().activeConversationId).toBe(
        'session-1',
      );
    });

    it('clears with null', () => {
      useCopilotStore.setState({ activeConversationId: 'session-1' });
      useCopilotStore.getState().setActiveConversation(null);
      expect(useCopilotStore.getState().activeConversationId).toBeNull();
    });
  });

  describe('setStreaming', () => {
    it('sets streaming state', () => {
      useCopilotStore.getState().setStreaming(true);
      expect(useCopilotStore.getState().isStreaming).toBe(true);
      useCopilotStore.getState().setStreaming(false);
      expect(useCopilotStore.getState().isStreaming).toBe(false);
    });
  });

  describe('setConnectionStatus', () => {
    it('sets connection status', () => {
      useCopilotStore.getState().setConnectionStatus('connecting');
      expect(useCopilotStore.getState().connectionStatus).toBe('connecting');
      useCopilotStore.getState().setConnectionStatus('connected');
      expect(useCopilotStore.getState().connectionStatus).toBe('connected');
      useCopilotStore.getState().setConnectionStatus('error');
      expect(useCopilotStore.getState().connectionStatus).toBe('error');
    });
  });

  describe('appendStreamChunk', () => {
    it('appends chunk to the specified message content', () => {
      const msg = makeMessage({
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello',
        isStreaming: true,
      });
      useCopilotStore.setState({ messages: [msg] });

      useCopilotStore.getState().appendStreamChunk('msg-1', ' world');
      expect(useCopilotStore.getState().messages[0]?.content).toBe(
        'Hello world',
      );
    });

    it('does not affect other messages', () => {
      const msg1 = makeMessage({ id: 'msg-1', content: 'First' });
      const msg2 = makeMessage({
        id: 'msg-2',
        role: 'assistant',
        content: 'Sec',
        isStreaming: true,
      });
      useCopilotStore.setState({ messages: [msg1, msg2] });

      useCopilotStore.getState().appendStreamChunk('msg-2', 'ond');
      expect(useCopilotStore.getState().messages[0]?.content).toBe('First');
      expect(useCopilotStore.getState().messages[1]?.content).toBe('Second');
    });
  });

  describe('switchToSession', () => {
    it('saves current messages and loads target session messages', () => {
      const sessionAMessages = [
        makeMessage({ id: 'm-a1', sessionId: 'session-a', content: 'A1' }),
      ];
      const sessionBMessages = [
        makeMessage({ id: 'm-b1', sessionId: 'session-b', content: 'B1' }),
      ];

      useCopilotStore.setState({
        activeConversationId: 'session-a',
        messages: sessionAMessages,
        sessionMessages: { 'session-b': sessionBMessages },
      });

      useCopilotStore.getState().switchToSession('session-b');

      const state = useCopilotStore.getState();
      expect(state.activeConversationId).toBe('session-b');
      expect(state.messages).toEqual(sessionBMessages);
      // Previous messages should be cached
      expect(state.sessionMessages['session-a']).toEqual(sessionAMessages);
    });

    it('loads empty array for session with no cached messages', () => {
      useCopilotStore.setState({
        activeConversationId: 'session-a',
        messages: [makeMessage()],
        sessionMessages: {},
      });

      useCopilotStore.getState().switchToSession('session-new');

      expect(useCopilotStore.getState().messages).toEqual([]);
      expect(useCopilotStore.getState().activeConversationId).toBe(
        'session-new',
      );
    });
  });

  describe('submitUserMessage', () => {
    it('adds a user message and opens the drawer', () => {
      useCopilotStore.setState({ isDrawerOpen: false });

      useCopilotStore.getState().submitUserMessage('Hello AI');

      const state = useCopilotStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]?.role).toBe('user');
      expect(state.messages[0]?.content).toBe('Hello AI');
      expect(state.isDrawerOpen).toBe(true);
    });

    it('does not submit empty/whitespace input', () => {
      useCopilotStore.getState().submitUserMessage('   ');

      expect(useCopilotStore.getState().messages).toHaveLength(0);
    });

    it('does not submit when isStreaming is true', () => {
      useCopilotStore.setState({ isStreaming: true });

      useCopilotStore.getState().submitUserMessage('Hello');

      expect(useCopilotStore.getState().messages).toHaveLength(0);
    });

    it('does not open drawer if already open', () => {
      useCopilotStore.setState({ isDrawerOpen: true });

      useCopilotStore.getState().submitUserMessage('Hello');

      // Should still be open (not toggled)
      expect(useCopilotStore.getState().isDrawerOpen).toBe(true);
      expect(useCopilotStore.getState().messages).toHaveLength(1);
    });
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  useCopilotStore,
  type ChatSession,
} from '@/stores/copilot-store';

import { ChatHistory } from './ChatHistory';

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 'session-1',
  title: 'Test Chat',
  lastMessageAt: new Date().toISOString(),
  messageCount: 3,
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ChatHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCopilotStore.setState({
      sessions: [],
      activeConversationId: null,
      messages: [],
      sessionMessages: {},
      isDrawerOpen: true,
      isStreaming: false,
      connectionStatus: 'disconnected',
      isMinimised: false,
      pendingInput: '',
      currentContext: null,
    });
  });

  it('renders session list from store', async () => {
    const user = userEvent.setup();
    useCopilotStore.setState({
      sessions: [
        makeSession({ id: 's-1', title: 'Chat about invoices' }),
        makeSession({ id: 's-2', title: 'Revenue discussion' }),
      ],
    });

    render(<ChatHistory />);

    // Open the dropdown
    const trigger = screen.getByRole('button', {
      name: 'copilot.recentChats',
    });
    await user.click(trigger);

    expect(screen.getByText('Chat about invoices')).toBeInTheDocument();
    expect(screen.getByText('Revenue discussion')).toBeInTheDocument();
  });

  it('sessions sorted by lastMessageAt descending', async () => {
    const user = userEvent.setup();
    useCopilotStore.setState({
      sessions: [
        makeSession({
          id: 's-old',
          title: 'Older Chat',
          lastMessageAt: '2026-02-20T10:00:00Z',
        }),
        makeSession({
          id: 's-new',
          title: 'Newer Chat',
          lastMessageAt: '2026-02-23T10:00:00Z',
        }),
      ],
    });

    render(<ChatHistory />);

    const trigger = screen.getByRole('button', {
      name: 'copilot.recentChats',
    });
    await user.click(trigger);

    const items = screen.getAllByRole('menuitem');
    // Newer should appear first
    expect(items[0]).toHaveTextContent('Newer Chat');
    expect(items[1]).toHaveTextContent('Older Chat');
  });

  it('selecting a session calls setActiveConversation', async () => {
    const user = userEvent.setup();
    useCopilotStore.setState({
      sessions: [makeSession({ id: 's-1', title: 'My Chat' })],
    });

    render(<ChatHistory />);

    const trigger = screen.getByRole('button', {
      name: 'copilot.recentChats',
    });
    await user.click(trigger);

    const sessionItem = screen.getByText('My Chat');
    await user.click(sessionItem);

    expect(useCopilotStore.getState().activeConversationId).toBe('s-1');
  });

  it('New Chat button creates new session and saves previous messages', async () => {
    const user = userEvent.setup();
    const oldMessage = {
      id: 'm-1',
      sessionId: 's-1',
      role: 'user' as const,
      content: 'Hi',
      timestamp: new Date().toISOString(),
    };
    useCopilotStore.setState({
      messages: [oldMessage],
      activeConversationId: 's-1',
    });

    render(<ChatHistory />);

    const newChatBtn = screen.getByRole('button', {
      name: 'copilot.newChat',
    });
    await user.click(newChatBtn);

    // Active messages should be empty (new session)
    expect(useCopilotStore.getState().messages).toEqual([]);
    // A new session should be created
    expect(useCopilotStore.getState().sessions).toHaveLength(1);
    expect(useCopilotStore.getState().sessions[0]?.title).toBe(
      'copilot.newChat',
    );
    // Previous session messages should be saved in cache
    expect(useCopilotStore.getState().sessionMessages['s-1']).toEqual([
      oldMessage,
    ]);
  });

  it('empty state shows "No previous chats" message', async () => {
    const user = userEvent.setup();

    render(<ChatHistory />);

    const trigger = screen.getByRole('button', {
      name: 'copilot.recentChats',
    });
    await user.click(trigger);

    expect(screen.getByText('copilot.noChats')).toBeInTheDocument();
  });
});

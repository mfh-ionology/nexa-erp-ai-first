import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useCopilotStore, type ChatMessage } from '@/stores/copilot-store';

// ── jsdom polyfills ──────────────────────────────────────────────────────────

// jsdom does not implement Element.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a
      href={to}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        mockNavigate({ to });
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock useAiChat to prevent WebSocket creation in tests
const mockConfirmAction = vi.fn();
const mockRejectAction = vi.fn();
vi.mock('@/hooks/use-ai-chat', () => ({
  useAiChat: () => ({
    sendMessage: vi.fn(),
    confirmAction: mockConfirmAction,
    rejectAction: mockRejectAction,
    connectionStatus: 'disconnected' as const,
    isConnected: false,
  }),
}));

import { CopilotChat } from './CopilotChat';

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  sessionId: 'session-1',
  role: 'user',
  content: 'Hello',
  timestamp: '2026-02-23T12:00:00.000Z',
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CopilotChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'u-1',
        email: 'test@nexa.io',
        firstName: 'Test',
        lastName: 'User',
      },
      permissions: null,
      isAuthenticated: true,
      accessToken: 'token',
      refreshToken: null,
      activeCompanyId: 'c-1',
      isLoading: false,
      rememberMe: false,
    });
    useCopilotStore.setState({
      messages: [],
      isDrawerOpen: true,
      isStreaming: false,
      connectionStatus: 'disconnected',
      sessionMessages: {},
      sessions: [],
      activeConversationId: null,
      isMinimised: false,
      pendingInput: '',
      currentContext: null,
    });
  });

  describe('message rendering', () => {
    it('user messages have primary background styling', () => {
      useCopilotStore.setState({
        messages: [makeMessage({ role: 'user', content: 'My question' })],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      const messageText = screen.getByText('My question');
      // The bubble parent should have bg-primary class
      const bubble = messageText.closest('[class*="bg-primary"]');
      expect(bubble).toBeTruthy();
    });

    it('AI messages have muted background styling', () => {
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'AI reply',
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      const messageText = screen.getByText('AI reply');
      const bubble = messageText.closest('[class*="bg-muted"]');
      expect(bubble).toBeTruthy();
    });

    it('streaming messages show pulsing dots indicator', () => {
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'Typing...',
            isStreaming: true,
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      // Streaming indicator has sr-only text for accessibility
      expect(screen.getByText('copilot.streaming')).toBeInTheDocument();
    });

    it('empty state shows welcome message', () => {
      useCopilotStore.setState({ messages: [] });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      expect(screen.getByText('copilot.emptyState')).toBeInTheDocument();
    });
  });

  describe('action proposals (BR-COM-013)', () => {
    it('renders action proposal card with description', () => {
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'I can create an invoice for you.',
            actionProposal: {
              id: 'ap-1',
              type: 'CREATE_INVOICE',
              description: 'Create Invoice for Acme Ltd',
              entityType: 'customerInvoice',
              previewData: { amount: '£1,200' },
              confidence: 0.92,
            },
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      expect(screen.getByText('copilot.actionProposal.title')).toBeInTheDocument();
      expect(screen.getByText('Create Invoice for Acme Ltd')).toBeInTheDocument();
    });

    it('approve and reject buttons are present', () => {
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'Proposal',
            actionProposal: {
              id: 'ap-1',
              type: 'CREATE_INVOICE',
              description: 'Test proposal',
              entityType: 'customerInvoice',
              previewData: {},
              confidence: 0.85,
            },
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      expect(screen.getByText('copilot.actionProposal.approve')).toBeInTheDocument();
      expect(screen.getByText('copilot.actionProposal.reject')).toBeInTheDocument();
    });

    it('clicking approve button calls confirmAction with proposal id', async () => {
      const user = userEvent.setup();
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'Proposal',
            actionProposal: {
              id: 'ap-1',
              type: 'CREATE_INVOICE',
              description: 'Test',
              entityType: 'customerInvoice',
              previewData: {},
              confidence: 0.9,
            },
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      const approveBtn = screen.getByText('copilot.actionProposal.approve');
      await user.click(approveBtn);

      expect(mockConfirmAction).toHaveBeenCalledWith('ap-1');
    });

    it('clicking reject button calls rejectAction with proposal id', async () => {
      const user = userEvent.setup();
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'Proposal',
            actionProposal: {
              id: 'ap-1',
              type: 'CREATE_INVOICE',
              description: 'Test',
              entityType: 'customerInvoice',
              previewData: {},
              confidence: 0.9,
            },
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      const rejectBtn = screen.getByText('copilot.actionProposal.reject');
      await user.click(rejectBtn);

      expect(mockRejectAction).toHaveBeenCalledWith('ap-1');
    });
  });

  describe('record links', () => {
    it('renders record link chips', () => {
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'Here is the invoice:',
            recordLinks: [
              {
                entityType: 'customerInvoice',
                entityId: '42',
                displayRef: 'INV-000042',
              },
            ],
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      expect(screen.getByText('INV-000042')).toBeInTheDocument();
    });

    it('clicking a record link calls router navigate', async () => {
      const user = userEvent.setup();
      useCopilotStore.setState({
        messages: [
          makeMessage({
            role: 'assistant',
            content: 'Link:',
            recordLinks: [
              {
                entityType: 'customerInvoice',
                entityId: '42',
                displayRef: 'INV-000042',
              },
            ],
          }),
        ],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      const chip = screen.getByText('INV-000042');
      await user.click(chip);

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/ar/invoices/42',
      });
    });
  });

  describe('accessibility', () => {
    it('message container has aria-live="polite"', () => {
      useCopilotStore.setState({
        messages: [makeMessage()],
      });
      render(<CopilotChat confirmAction={vi.fn()} rejectAction={vi.fn()} />);

      const container = screen.getByText('Hello').closest('[aria-live]');
      expect(container).toHaveAttribute('aria-live', 'polite');
    });
  });
});

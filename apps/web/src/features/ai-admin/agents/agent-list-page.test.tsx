/* eslint-disable i18next/no-literal-string */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAgentListItem } from '../api/types';

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// --- Mock TanStack Router ---
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Mock sonner toast ---
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Mock useAiAgents and mutations ---
const mockFetchNextPage = vi.fn();
const mockUseAiAgents = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('../api/use-ai-agents', () => ({
  useAiAgents: (...args: unknown[]) => mockUseAiAgents(...args),
  useUpdateAiAgent: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useDeleteAiAgent: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

// --- Test data ---
const testAgents: AiAgentListItem[] = [
  {
    id: 'agent-1',
    name: 'invoice-creator',
    displayName: 'Invoice Creator',
    description: 'Creates invoices from natural language',
    modelId: 'model-1',
    modelDisplayName: 'Claude Opus 4.6',
    promptId: 'prompt-1',
    promptName: 'invoice-system',
    routingTags: ['standard', 'reasoning'],
    toolCount: 5,
    maxTurns: 10,
    isActive: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'agent-2',
    name: 'chat-router',
    displayName: 'Chat Router',
    description: 'Routes chat messages to appropriate handlers',
    modelId: null,
    modelDisplayName: null,
    promptId: 'prompt-2',
    promptName: 'router-prompt',
    routingTags: ['fast'],
    toolCount: 0,
    maxTurns: 5,
    isActive: false,
    createdAt: '2026-03-02T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
  },
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseAiAgents.mockReturnValue({
    data: { data: testAgents },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isSuccess: true,
    ...overrides,
  });
}

// Dynamic import after mocks
async function renderPage() {
  const { AgentListPage } = await import('./agent-list-page');
  return render(<AgentListPage />);
}

describe('AgentListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders page title "Agent Configuration"', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Agent Configuration');
    });

    it('renders column headers', async () => {
      await renderPage();

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toEqual(expect.arrayContaining(['Name', 'Display Name']));
    });

    it('renders agent data in the table', async () => {
      await renderPage();

      expect(screen.getByText('invoice-creator')).toBeInTheDocument();
      expect(screen.getByText('chat-router')).toBeInTheDocument();
      expect(screen.getByText('Invoice Creator')).toBeInTheDocument();
      expect(screen.getByText('Chat Router')).toBeInTheDocument();
    });

    it('renders routing tags as badges', async () => {
      await renderPage();

      expect(screen.getByText('standard')).toBeInTheDocument();
      expect(screen.getByText('reasoning')).toBeInTheDocument();
      expect(screen.getByText('fast')).toBeInTheDocument();
    });

    it('renders active/inactive status indicators', async () => {
      await renderPage();

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('renders "Auto-routed" when modelId is null', async () => {
      await renderPage();

      expect(screen.getByText('Auto-routed')).toBeInTheDocument();
    });
  });

  // --- Search ---

  describe('search', () => {
    it('search input renders', async () => {
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      expect(searchInput).toBeInTheDocument();
    });

    it('typing triggers debounced search', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      await user.type(searchInput, 'invoice');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const lastCall = mockUseAiAgents.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'invoice' }));

      vi.useRealTimers();
    });
  });

  // --- Row click ---

  describe('row click', () => {
    it('clicking a row navigates to /ai/admin/agents/:id', async () => {
      const user = userEvent.setup();
      await renderPage();

      const row = screen.getByText('invoice-creator').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/agents/agent-1' }),
      );
    });
  });

  // --- Pagination ---

  describe('pagination', () => {
    it('shows "Load More" when hasNextPage is true', async () => {
      setupMockQuery({ hasNextPage: true });
      await renderPage();

      expect(screen.getByText('loadMore')).toBeInTheDocument();
    });

    it('hides "Load More" when hasNextPage is false', async () => {
      setupMockQuery({ hasNextPage: false });
      await renderPage();

      expect(screen.queryByText('loadMore')).not.toBeInTheDocument();
    });
  });
});

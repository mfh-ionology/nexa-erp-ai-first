/* eslint-disable i18next/no-literal-string */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiPromptListItem } from '../api/types';

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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Mock date-fns ---
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

// --- Mock prompt hooks ---
const mockFetchNextPage = vi.fn();
const mockUseAiPrompts = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('../api/use-ai-prompts', () => ({
  useAiPrompts: (...args: unknown[]) => mockUseAiPrompts(...args),
  useUpdateAiPrompt: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useDeleteAiPrompt: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

// --- Test data ---
const testPrompts: AiPromptListItem[] = [
  {
    id: 'prompt-1',
    name: 'record-create-invoice',
    description: 'Creates invoice records',
    category: 'record-creation',
    activeVersion: 3,
    isActive: true,
    variableCount: 2,
    createdBy: 'user-1',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
  },
  {
    id: 'prompt-2',
    name: 'query-sales-report',
    description: 'Generates sales reports',
    category: 'query',
    activeVersion: 1,
    isActive: false,
    variableCount: 0,
    createdBy: 'user-1',
    createdAt: '2026-03-02T00:00:00Z',
    updatedAt: '2026-03-02T10:00:00Z',
  },
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseAiPrompts.mockReturnValue({
    data: { data: testPrompts },
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
  const { PromptListPage } = await import('./prompt-list-page');
  return render(<PromptListPage />);
}

describe('PromptListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders page title "Prompt Templates"', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Prompt Templates');
    });

    it('renders column headers (Name, Category, Version, Variables, Status, Last Updated)', async () => {
      await renderPage();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Version')).toBeInTheDocument();
      expect(screen.getByText('Variables')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Last Updated')).toBeInTheDocument();
    });

    it('renders prompt data in the table', async () => {
      await renderPage();

      expect(screen.getByText('record-create-invoice')).toBeInTheDocument();
      expect(screen.getByText('query-sales-report')).toBeInTheDocument();
    });

    it('renders category badges', async () => {
      await renderPage();

      expect(screen.getByText('record-creation')).toBeInTheDocument();
      expect(screen.getByText('query')).toBeInTheDocument();
    });

    it('renders version numbers', async () => {
      await renderPage();

      expect(screen.getByText('v3')).toBeInTheDocument();
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    it('renders active/inactive status indicators', async () => {
      await renderPage();

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  // --- Category filter ---

  describe('category filter', () => {
    it('renders category filter dropdown', async () => {
      await renderPage();

      // The SelectTrigger has aria-label "Filter by category"
      expect(screen.getByLabelText('Filter by category')).toBeInTheDocument();
    });
  });

  // --- Search ---

  describe('search', () => {
    it('search input renders with placeholder', async () => {
      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      expect(searchInput).toBeInTheDocument();
    });

    it('typing triggers debounced search (300ms)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await renderPage();

      const searchInput = screen.getByRole('textbox', { name: 'search' });
      await user.type(searchInput, 'invoice');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const lastCall = mockUseAiPrompts.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'invoice' }));

      vi.useRealTimers();
    });
  });

  // --- Row click ---

  describe('row click', () => {
    it('clicking a row navigates to /ai/admin/prompts/:id', async () => {
      const user = userEvent.setup();
      await renderPage();

      const row = screen.getByText('record-create-invoice').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/prompts/prompt-1' }),
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

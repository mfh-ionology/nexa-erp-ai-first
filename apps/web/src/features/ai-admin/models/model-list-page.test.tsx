/* eslint-disable i18next/no-literal-string */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiModelListItem } from '../api/types';

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

// --- Mock useAiModels and mutations ---
const mockFetchNextPage = vi.fn();
const mockUseAiModels = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('../api/use-ai-models', () => ({
  useAiModels: (...args: unknown[]) => mockUseAiModels(...args),
  useUpdateAiModel: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useDeleteAiModel: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

// --- Test data ---
const testModels: AiModelListItem[] = [
  {
    id: 'model-1',
    name: 'claude-opus',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    maxInputTokens: 200000,
    maxOutputTokens: 32000,
    costPerMInput: '15.00',
    costPerMOutput: '75.00',
    routingTags: ['reasoning', 'standard'],
    capabilities: { vision: true },
    isActive: true,
    isDefault: true,
    fallbackModelId: null,
    agentCount: 0,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'model-2',
    name: 'gpt-4',
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    costPerMInput: '10.00',
    costPerMOutput: '30.00',
    routingTags: ['fast'],
    capabilities: {},
    isActive: false,
    isDefault: false,
    fallbackModelId: null,
    agentCount: 0,
    createdAt: '2026-03-02T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
  },
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseAiModels.mockReturnValue({
    data: { data: testModels },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isSuccess: true,
    ...overrides,
  });
}

// Dynamic import after mocks are set up
async function renderPage() {
  const { ModelListPage } = await import('./model-list-page');
  return render(<ModelListPage />);
}

describe('ModelListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders page title "Model Registry"', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Model Registry');
    });

    it('renders column headers', async () => {
      await renderPage();

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toEqual(
        expect.arrayContaining([
          'Name',
          'Provider',
          'Model ID',
          'Max Tokens',
          'Cost/M In',
          'Cost/M Out',
          'Status',
          'Default',
        ]),
      );
    });

    it('renders model data in the table', async () => {
      await renderPage();

      expect(screen.getByText('claude-opus')).toBeInTheDocument();
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('Openai')).toBeInTheDocument();
    });

    it('renders routing tags as badges', async () => {
      await renderPage();

      expect(screen.getByText('reasoning')).toBeInTheDocument();
      expect(screen.getByText('standard')).toBeInTheDocument();
      expect(screen.getByText('fast')).toBeInTheDocument();
    });

    it('renders active/inactive status indicators', async () => {
      await renderPage();

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
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
      await user.type(searchInput, 'claude');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const lastCall = mockUseAiModels.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'claude' }));

      vi.useRealTimers();
    });
  });

  // --- Row click ---

  describe('row click', () => {
    it('clicking a row navigates to /ai/admin/models/:id', async () => {
      const user = userEvent.setup();
      await renderPage();

      const row = screen.getByText('claude-opus').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/models/model-1' }),
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

/* eslint-disable i18next/no-literal-string */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAutomationListItem } from '../api/types';

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

// --- Mock automation hooks ---
const mockFetchNextPage = vi.fn();
const mockUseAiAutomations = vi.fn();
const mockToggleMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockRunMutate = vi.fn();

vi.mock('../api/use-ai-automations', () => ({
  useAiAutomations: (...args: unknown[]) => mockUseAiAutomations(...args),
  useToggleAutomationActive: () => ({ mutate: mockToggleMutate, isPending: false }),
  useDeleteAiAutomation: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useRunAutomation: () => ({ mutate: mockRunMutate, isPending: false }),
}));

// --- Test data ---
const testAutomations: AiAutomationListItem[] = [
  {
    id: 'auto-1',
    name: 'Daily AR Analysis',
    description: 'Analyse overdue invoices each morning',
    triggerType: 'SCHEDULED',
    eventType: null,
    isActive: true,
    maxTokenBudget: 50000,
    maxDurationMs: 300000,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    lastRunId: null,
    lastRunStatus: 'COMPLETED',
    lastRunAt: '2026-03-03T07:00:00Z',
    stepCount: 3,
    schedule: {
      id: 'sched-1',
      cronExpression: '0 7 * * 1-5',
      timezone: 'Europe/London',
      nextRunAt: '2026-03-04T07:00:00Z',
      lastRunAt: '2026-03-03T07:00:00Z',
      isPaused: false,
    },
  },
  {
    id: 'auto-2',
    name: 'Stock Reorder Alert',
    description: 'Triggered when stock falls below reorder point',
    triggerType: 'EVENT',
    eventType: 'stock.reorder.triggered',
    isActive: true,
    maxTokenBudget: 30000,
    maxDurationMs: 120000,
    createdAt: '2026-03-02T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
    lastRunId: null,
    lastRunStatus: 'FAILED',
    lastRunAt: '2026-03-02T12:30:00Z',
    stepCount: 1,
    schedule: null,
  },
  {
    id: 'auto-3',
    name: 'Manual Report Generator',
    description: null,
    triggerType: 'MANUAL',
    eventType: null,
    isActive: false,
    maxTokenBudget: 50000,
    maxDurationMs: 300000,
    createdAt: '2026-03-02T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
    lastRunId: null,
    lastRunStatus: null,
    lastRunAt: null,
    stepCount: 0,
    schedule: null,
  },
];

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseAiAutomations.mockReturnValue({
    data: { data: testAutomations },
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
  const { AutomationListPage } = await import('./automation-list-page');
  return render(<AutomationListPage />);
}

describe('AutomationListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders page title "Automations"', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Automations');
    });

    it('renders automation data in the table', async () => {
      await renderPage();

      expect(screen.getByText('Daily AR Analysis')).toBeInTheDocument();
      expect(screen.getByText('Stock Reorder Alert')).toBeInTheDocument();
      expect(screen.getByText('Manual Report Generator')).toBeInTheDocument();
    });

    it('renders trigger type badges with correct text', async () => {
      await renderPage();

      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Event')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('renders human-readable schedule for scheduled automations', async () => {
      await renderPage();

      // "0 7 * * 1-5" should render as something containing "7:00 AM" and weekday info
      expect(screen.getByText(/7:00 AM/)).toBeInTheDocument();
    });

    it('renders last run status "Completed" for completed automation', async () => {
      await renderPage();

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders last run status "Failed" for failed automation', async () => {
      await renderPage();

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders "Never run" for automation with no last run', async () => {
      await renderPage();

      expect(screen.getByText('Never run')).toBeInTheDocument();
    });

    it('renders active toggle switches', async () => {
      await renderPage();

      // There should be multiple switches (one per row)
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBe(testAutomations.length);
    });

    it('renders empty state when no automations', async () => {
      setupMockQuery({ data: { data: [] } });
      await renderPage();

      // EntityListPage shows an empty state
      expect(screen.queryByText('Daily AR Analysis')).not.toBeInTheDocument();
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
      await user.type(searchInput, 'daily');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const lastCall = mockUseAiAutomations.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ search: 'daily' }));

      vi.useRealTimers();
    });
  });

  // --- Active toggle ---

  describe('active toggle', () => {
    it('clicking toggle fires mutation', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Find the toggle for the first automation (active)
      const toggles = screen.getAllByRole('switch');
      await user.click(toggles[0]!);

      expect(mockToggleMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'auto-1' }),
        expect.anything(),
      );
    });
  });

  // --- Row click ---

  describe('row click', () => {
    it('clicking a row navigates to automation edit page', async () => {
      const user = userEvent.setup();
      await renderPage();

      const row = screen.getByText('Daily AR Analysis').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/automations/auto-1' }),
      );
    });
  });

  // --- Run Now dialog ---

  describe('run now', () => {
    it('Run Now in overflow menu shows confirmation dialog', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Open the overflow menu for the first row
      const actionButtons = screen.getAllByLabelText(/Actions for/i);
      await user.click(actionButtons[0]!);

      // Click "Run Now" menu item
      const runNowItem = screen.getByText('Run Now');
      await user.click(runNowItem);

      // Confirmation dialog should appear
      expect(screen.getByText('Run Automation')).toBeInTheDocument();
      expect(screen.getByText(/execute immediately/i)).toBeInTheDocument();
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

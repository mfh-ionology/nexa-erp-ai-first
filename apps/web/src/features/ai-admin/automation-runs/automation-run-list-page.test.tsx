/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAutomationRunListItem } from '../api/types';

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

// --- Mock run hooks ---
const mockFetchNextPage = vi.fn();
const mockUseAllAutomationRuns = vi.fn();
const mockUseAutomationRuns = vi.fn();
const mockRetryMutate = vi.fn();

vi.mock('../api/use-ai-automation-runs', () => ({
  useAllAutomationRuns: (...args: unknown[]) => mockUseAllAutomationRuns(...args),
  useAutomationRuns: (...args: unknown[]) => mockUseAutomationRuns(...args),
  useRetryAutomationRun: () => ({ mutate: mockRetryMutate, isPending: false }),
}));

// --- Mock automation hooks (used by filter bar) ---
vi.mock('../api/use-ai-automations', () => ({
  useAiAutomations: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

// --- Test data ---
const testRuns: AiAutomationRunListItem[] = [
  {
    id: 'run-1',
    automationId: 'auto-1',
    automationName: 'Daily AR Analysis',
    triggerType: 'SCHEDULED',
    triggeredBy: 'scheduler',
    status: 'COMPLETED',
    startedAt: '2026-03-03T07:00:00Z',
    completedAt: '2026-03-03T07:00:45Z',
    totalTokens: 12345,
    totalCost: '0.0312',
    error: null,
    createdAt: '2026-03-03T07:00:00Z',
  },
  {
    id: 'run-2',
    automationId: 'auto-2',
    automationName: 'Stock Reorder Alert',
    triggerType: 'EVENT',
    triggeredBy: 'event:stock.reorder',
    status: 'FAILED',
    startedAt: '2026-03-02T12:30:00Z',
    completedAt: '2026-03-02T12:31:15Z',
    totalTokens: 8720,
    totalCost: '0.0218',
    error: 'Agent timeout exceeded',
    createdAt: '2026-03-02T12:30:00Z',
  },
  {
    id: 'run-3',
    automationId: 'auto-3',
    automationName: 'Report Generator',
    triggerType: 'MANUAL',
    triggeredBy: 'manual:admin@example.com',
    status: 'RUNNING',
    startedAt: '2026-03-03T10:00:00Z',
    completedAt: null,
    totalTokens: 500,
    totalCost: '0.0010',
    error: null,
    createdAt: '2026-03-03T10:00:00Z',
  },
  {
    id: 'run-4',
    automationId: 'auto-4',
    automationName: 'Chain Process',
    triggerType: 'CHAIN',
    triggeredBy: 'chain:DailyARAnalysis',
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    totalTokens: 0,
    totalCost: '0.0000',
    error: null,
    createdAt: '2026-03-03T10:05:00Z',
  },
  {
    id: 'run-5',
    automationId: 'auto-1',
    automationName: 'Daily AR Analysis',
    triggerType: 'SCHEDULED',
    triggeredBy: 'scheduler',
    status: 'CANCELLED',
    startedAt: '2026-03-01T07:00:00Z',
    completedAt: '2026-03-01T07:00:05Z',
    totalTokens: 200,
    totalCost: '0.0005',
    error: null,
    createdAt: '2026-03-01T07:00:00Z',
  },
];

const disabledQuery = {
  data: { data: [] },
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isSuccess: true,
};

function setupMockQuery(overrides: Record<string, unknown> = {}) {
  mockUseAllAutomationRuns.mockReturnValue({
    data: { data: testRuns },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isSuccess: true,
    ...overrides,
  });
  // Scoped query disabled by default (no automationId prop)
  mockUseAutomationRuns.mockReturnValue(disabledQuery);
}

// Dynamic import after mocks
async function renderPage(props: { automationId?: string; automationName?: string } = {}) {
  const { AutomationRunListPage } = await import('./automation-run-list-page');
  return render(<AutomationRunListPage {...props} />);
}

describe('AutomationRunListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQuery();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders page title "Automation Runs"', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Automation Runs');
    });

    it('renders run data in the table', async () => {
      await renderPage();

      // "Daily AR Analysis" appears twice (run-1 and run-5)
      expect(screen.getAllByText('Daily AR Analysis').length).toBe(2);
      expect(screen.getByText('Stock Reorder Alert')).toBeInTheDocument();
      expect(screen.getByText('Report Generator')).toBeInTheDocument();
    });

    it('renders trigger type badges with correct text', async () => {
      await renderPage();

      expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Event')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
      expect(screen.getByText('Chain')).toBeInTheDocument();
    });

    it('renders status badges for each run status', async () => {
      await renderPage();

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('formats triggered by — strips "manual:" prefix', async () => {
      await renderPage();

      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });

    it('formats triggered by — shows "Scheduler" for scheduler', async () => {
      await renderPage();

      expect(screen.getAllByText('Scheduler').length).toBeGreaterThanOrEqual(1);
    });

    it('formats triggered by — shows "Chain:" for chained runs', async () => {
      await renderPage();

      expect(screen.getByText('Chain: DailyARAnalysis')).toBeInTheDocument();
    });

    it('renders formatted date for started at', async () => {
      await renderPage();

      // Multiple dates match "03 Mar 2026" from format(date, 'dd MMM yyyy HH:mm:ss')
      const dateElements = screen.getAllByText(/03 Mar 2026/);
      expect(dateElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders total tokens with comma formatting', async () => {
      await renderPage();

      // 12345 → "12,345"
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });

    it('renders total cost with £ symbol and 4 decimal places', async () => {
      await renderPage();

      expect(screen.getByText('£0.0312')).toBeInTheDocument();
    });

    it('renders duration as "45s" for completed run', async () => {
      await renderPage();

      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('renders empty state when no runs', async () => {
      setupMockQuery({ data: { data: [] } });
      await renderPage();

      expect(screen.queryByText('Daily AR Analysis')).not.toBeInTheDocument();
    });
  });

  // --- Row click ---

  describe('row click', () => {
    it('clicking a row navigates to run detail page', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Use a unique automation name to avoid ambiguity
      const row = screen.getByText('Stock Reorder Alert').closest('tr');
      expect(row).toBeTruthy();
      await user.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/automations/runs/run-2' }),
      );
    });
  });

  // --- Actions dropdown ---

  describe('actions dropdown', () => {
    it('"Retry" action only appears for FAILED runs', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Open the overflow menu for the FAILED run (run-2)
      const actionButtons = screen.getAllByLabelText(/Actions for run/i);
      // run-2 is the second run in order
      await user.click(actionButtons[1]!);

      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('"Retry" action does NOT appear for COMPLETED runs', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Open the overflow menu for the COMPLETED run (run-1)
      const actionButtons = screen.getAllByLabelText(/Actions for run/i);
      await user.click(actionButtons[0]!);

      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('"Retry" action shows confirmation dialog', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Open menu for FAILED run
      const actionButtons = screen.getAllByLabelText(/Actions for run/i);
      await user.click(actionButtons[1]!);

      // Click Retry
      const retryItem = screen.getByText('Retry');
      await user.click(retryItem);

      // Confirmation dialog should appear
      expect(screen.getByText('Retry Automation Run')).toBeInTheDocument();
      expect(screen.getByText(/Previous step outputs will be preserved/i)).toBeInTheDocument();
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

  // --- Per-automation scoped mode ---

  describe('per-automation scoped mode', () => {
    it('uses scoped query when automationId is provided', async () => {
      mockUseAutomationRuns.mockReturnValue({
        data: { data: [testRuns[0]] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        isSuccess: true,
      });
      await renderPage({ automationId: 'auto-1', automationName: 'Daily AR Analysis' });

      expect(mockUseAutomationRuns).toHaveBeenCalledWith('auto-1', expect.anything());
    });
  });
});

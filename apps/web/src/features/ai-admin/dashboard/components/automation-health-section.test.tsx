/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { AutomationHealthStats } from '../../api/types';

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

// --- Mock automation health hook ---
const mockUseAutomationHealth = vi.fn();
vi.mock('../../api/use-ai-automation-health', () => ({
  useAutomationHealth: () => mockUseAutomationHealth(),
}));

// --- Mock update automation hook ---
const mockUpdateMutate = vi.fn();
vi.mock('../../api/use-ai-automations', () => ({
  useUpdateAiAutomation: () => ({ mutate: mockUpdateMutate, isPending: false }),
}));

// --- Mock Recharts to avoid SVG rendering issues in jsdom ---
vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'area-chart' }, children);
  },
  CartesianGrid: () => null,
  Cell: () => null,
  Pie: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'pie-chart' }, children);
  },
  XAxis: () => null,
  YAxis: () => null,
}));

// --- Mock ChartContainer ---
vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'chart-container' }, children);
  },
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

// --- Test data ---
const now = new Date('2026-03-03T12:00:00Z');

const healthyStats: AutomationHealthStats = {
  totalAutomations: 5,
  activeCount: 3,
  pausedCount: 1,
  inactiveCount: 1,
  failedRunsLast24h: 0,
  upcomingRuns: [
    {
      automationId: 'auto-1',
      automationName: 'Daily AR Analysis',
      nextRunAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // in 2 hours
    },
    {
      automationId: 'auto-2',
      automationName: 'Weekly Report',
      nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // in 1 day
    },
  ],
  dailyTokenSpend: [
    { date: '2026-02-25', tokens: 5000 },
    { date: '2026-02-26', tokens: 12000 },
    { date: '2026-02-27', tokens: 8000 },
    { date: '2026-02-28', tokens: 15000 },
    { date: '2026-03-01', tokens: 9000 },
    { date: '2026-03-02', tokens: 11000 },
    { date: '2026-03-03', tokens: 3000 },
  ],
  circuitBreakerAlerts: [],
};

const unhealthyStats: AutomationHealthStats = {
  totalAutomations: 4,
  activeCount: 2,
  pausedCount: 1,
  inactiveCount: 1,
  failedRunsLast24h: 3,
  upcomingRuns: [],
  dailyTokenSpend: [
    { date: '2026-02-25', tokens: 0 },
    { date: '2026-02-26', tokens: 0 },
    { date: '2026-02-27', tokens: 0 },
    { date: '2026-02-28', tokens: 0 },
    { date: '2026-03-01', tokens: 0 },
    { date: '2026-03-02', tokens: 0 },
    { date: '2026-03-03', tokens: 0 },
  ],
  circuitBreakerAlerts: [
    {
      automationId: 'auto-paused-1',
      automationName: 'Stock Reorder Alert',
      consecutiveFailures: 3,
      lastFailedAt: '2026-03-03T10:00:00Z',
    },
  ],
};

function setupMocks(
  overrides: {
    health?: AutomationHealthStats | undefined;
    isLoading?: boolean;
  } = {},
) {
  mockUseAutomationHealth.mockReturnValue({
    data: overrides.health ?? healthyStats,
    isLoading: overrides.isLoading ?? false,
  });
}

// Dynamic import after mocks
async function renderSection() {
  const { AutomationHealthSection } = await import('./automation-health-section');
  return render(<AutomationHealthSection />);
}

describe('AutomationHealthSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    setupMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders "Automation Health" heading', async () => {
      await renderSection();

      expect(screen.getByText('Automation Health')).toBeInTheDocument();
    });

    it('renders "View All Runs" button', async () => {
      await renderSection();

      expect(screen.getByText('View All Runs')).toBeInTheDocument();
    });

    it('"View All Runs" navigates to runs page', async () => {
      const user = userEvent.setup();
      await renderSection();

      const viewAllBtn = screen.getByText('View All Runs');
      await user.click(viewAllBtn);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/automations/runs' }),
      );
    });
  });

  // --- Automations by status ---

  describe('automations by status', () => {
    it('renders active/paused/inactive counts with legend', async () => {
      await renderSection();

      expect(screen.getByText('3 Active')).toBeInTheDocument();
      expect(screen.getByText('1 Paused')).toBeInTheDocument();
      expect(screen.getByText('1 Inactive')).toBeInTheDocument();
    });

    it('renders pie chart', async () => {
      await renderSection();

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('clicking navigates to automation list', async () => {
      const user = userEvent.setup();
      await renderSection();

      const donut = screen.getByText('Automations by Status').closest('button');
      expect(donut).toBeTruthy();
      await user.click(donut!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/automations' }),
      );
    });
  });

  // --- Failed runs count ---

  describe('failed runs count', () => {
    it('shows green "All healthy" when no failures', async () => {
      await renderSection();

      expect(screen.getByText('All healthy')).toBeInTheDocument();
    });

    it('shows red count when failures exist', async () => {
      setupMocks({ health: unhealthyStats });
      await renderSection();

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.queryByText('All healthy')).not.toBeInTheDocument();
    });

    it('clicking failed runs navigates with filter', async () => {
      const user = userEvent.setup();
      setupMocks({ health: unhealthyStats });
      await renderSection();

      const failedCard = screen.getByText('Failed Runs (24h)').closest('button');
      expect(failedCard).toBeTruthy();
      await user.click(failedCard!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/ai/admin/automations/runs',
          search: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  // --- Upcoming runs ---

  describe('upcoming runs', () => {
    it('displays upcoming run automation names', async () => {
      await renderSection();

      expect(screen.getByText('Daily AR Analysis')).toBeInTheDocument();
      expect(screen.getByText('Weekly Report')).toBeInTheDocument();
    });

    it('shows "No upcoming runs" when empty', async () => {
      setupMocks({ health: unhealthyStats });
      await renderSection();

      expect(screen.getByText('No upcoming runs')).toBeInTheDocument();
    });
  });

  // --- Token spend chart ---

  describe('token spend chart', () => {
    it('renders area chart for token spend', async () => {
      await renderSection();

      expect(screen.getByText('Token Spend (7d)')).toBeInTheDocument();
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });

    it('shows "No automation token usage" when all zeros', async () => {
      setupMocks({ health: unhealthyStats });
      await renderSection();

      expect(screen.getByText('No automation token usage')).toBeInTheDocument();
    });
  });

  // --- Circuit breaker warnings (AC-7) ---

  describe('circuit breaker warnings', () => {
    it('shows warning banner when paused automations exist', async () => {
      setupMocks({ health: unhealthyStats });
      await renderSection();

      expect(screen.getByText(/Stock Reorder Alert/)).toBeInTheDocument();
      expect(screen.getByText(/has been paused after 3 consecutive failures/)).toBeInTheDocument();
    });

    it('no warning banners when no circuit breaker alerts', async () => {
      await renderSection();

      expect(
        screen.queryByText(/has been paused after 3 consecutive failures/),
      ).not.toBeInTheDocument();
    });

    it('"View Runs" button navigates to filtered runs', async () => {
      const user = userEvent.setup();
      setupMocks({ health: unhealthyStats });
      await renderSection();

      const viewRunsBtn = screen.getByText('View Runs');
      await user.click(viewRunsBtn);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/ai/admin/automations/runs',
          search: expect.objectContaining({
            automationId: 'auto-paused-1',
            status: 'FAILED',
          }),
        }),
      );
    });

    it('"Resume" button shows confirmation dialog', async () => {
      const user = userEvent.setup();
      setupMocks({ health: unhealthyStats });
      await renderSection();

      const resumeBtn = screen.getByText('Resume');
      await user.click(resumeBtn);

      expect(screen.getByText('Resume Automation')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to resume/)).toBeInTheDocument();
      // "Stock Reorder Alert" appears in both banner and dialog
      expect(screen.getAllByText(/Stock Reorder Alert/).length).toBeGreaterThanOrEqual(2);
    });

    it('confirming resume fires update mutation', async () => {
      const user = userEvent.setup();
      setupMocks({ health: unhealthyStats });
      await renderSection();

      // Open resume dialog
      const resumeBtn = screen.getByText('Resume');
      await user.click(resumeBtn);

      // Find dialog and confirm
      const dialogContent = screen.getByRole('alertdialog');
      // The confirm button contains "Resume" text
      const confirmButtons = dialogContent.querySelectorAll('button');
      const confirmBtn = Array.from(confirmButtons).find((btn) => btn.textContent === 'Resume');
      expect(confirmBtn).toBeTruthy();
      await user.click(confirmBtn!);

      expect(mockUpdateMutate).toHaveBeenCalledWith(
        { id: 'auto-paused-1', data: { isActive: true } },
        expect.anything(),
      );
    });
  });

  // --- Loading state ---

  describe('loading state', () => {
    it('renders skeleton when loading', async () => {
      setupMocks({ isLoading: true, health: undefined });
      await renderSection();

      expect(screen.getByText('Automation Health')).toBeInTheDocument();
      // Should not render any data content
      expect(screen.queryByText('All healthy')).not.toBeInTheDocument();
      expect(screen.queryByText('Automations by Status')).not.toBeInTheDocument();
    });
  });

  // --- No data state ---

  describe('no data state', () => {
    it('returns null when health data is undefined', async () => {
      mockUseAutomationHealth.mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      const { container } = await renderSection();

      // Should render nothing (null return)
      expect(container.childElementCount).toBe(0);
    });
  });
});

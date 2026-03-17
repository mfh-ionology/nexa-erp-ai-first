/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AnalyticsSummary, AnalyticsAlert, BreakdownItem } from '../../api/use-ai-analytics';

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// --- Mock TanStack Router ---
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
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

// --- Mock analytics hooks ---
const mockUseAiAnalyticsSummary = vi.fn();
const mockUseAiAnalyticsBreakdown = vi.fn();
const mockUseAiAnalyticsAlerts = vi.fn();
const mockExportMutate = vi.fn();

vi.mock('../../api/use-ai-analytics', () => ({
  useAiAnalyticsSummary: (...args: unknown[]) => mockUseAiAnalyticsSummary(...args),
  useAiAnalyticsBreakdown: (...args: unknown[]) => mockUseAiAnalyticsBreakdown(...args),
  useAiAnalyticsAlerts: () => mockUseAiAnalyticsAlerts(),
  useAiAnalyticsExport: () => ({ mutate: mockExportMutate, isPending: false }),
}));

// --- Mock recharts (used by TokenChart and CostByModel) ---
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'responsive-container' }, children);
  },
  LineChart: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'line-chart' }, children);
  },
  BarChart: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'bar-chart' }, children);
  },
  PieChart: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'pie-chart' }, children);
  },
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// --- Test data ---
const testSummary: AnalyticsSummary = {
  totalTokens: 1500000,
  totalCost: 45.5,
  requestCount: { chat: 200, automation: 50, total: 250 },
  avgLatencyMs: 1200,
  trends: { tokens: 12.5, cost: 8.3, latency: -5.0 },
};

const testAlerts: AnalyticsAlert[] = [
  {
    type: 'cost_threshold',
    severity: 'critical',
    title: 'Cost threshold exceeded',
    detail: 'Module X has exceeded its monthly budget',
    moduleOrAgent: 'module-x',
    currentValue: 150,
    thresholdValue: 100,
  },
  {
    type: 'anomaly',
    severity: 'warning',
    title: 'Usage anomaly detected',
    detail: 'Unusual token spike for Agent Y',
    moduleOrAgent: 'agent-y',
    currentValue: 5000,
    thresholdValue: 2000,
  },
];

const testBreakdownItems: BreakdownItem[] = [
  {
    group: 'claude-opus',
    groupId: 'model-1',
    requests: 150,
    tokensIn: 500000,
    tokensOut: 200000,
    cost: 30.0,
    avgLatencyMs: 1100,
  },
];

function setupMocks(
  overrides: {
    summary?: AnalyticsSummary | null;
    alerts?: AnalyticsAlert[];
    breakdown?: BreakdownItem[];
    summaryLoading?: boolean;
  } = {},
) {
  const {
    summary = testSummary,
    alerts = [],
    breakdown = testBreakdownItems,
    summaryLoading = false,
  } = overrides;

  mockUseAiAnalyticsSummary.mockReturnValue({
    data: summary ?? undefined,
    isLoading: summaryLoading,
  });

  mockUseAiAnalyticsBreakdown.mockReturnValue({
    data: breakdown,
    isLoading: false,
  });

  mockUseAiAnalyticsAlerts.mockReturnValue({
    data: alerts,
    isLoading: false,
  });
}

async function renderPage() {
  const { AiAnalyticsPage } = await import('../ai-analytics-page');
  return render(<AiAnalyticsPage />);
}

describe('AiAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders the page title', async () => {
      await renderPage();

      // PageHeader renders both a heading and a breadcrumb with analytics.title
      // Use getByRole heading to be specific
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('analytics.title');
    }, 15000);

    it('renders 4 summary cards when data is available', async () => {
      await renderPage();

      // Each label appears as a <p> in the metric card
      // Use getAllByText and check at least one instance exists for each label
      expect(screen.getAllByText('analytics.totalTokens').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('analytics.totalCost').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('analytics.aiRequests').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('analytics.avgLatency').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Export CSV button', async () => {
      await renderPage();

      expect(screen.getByText('analytics.exportCsv')).toBeInTheDocument();
    });

    it('renders date range selector', async () => {
      await renderPage();

      // Select trigger should be rendered — check for date range i18n keys
      expect(screen.getByText('analytics.last7d')).toBeInTheDocument();
    });
  });

  // --- Alert banners ---

  describe('alert banners', () => {
    it('shows alert banners when alert data is present', async () => {
      setupMocks({ alerts: testAlerts });
      await renderPage();

      // AlertBanner renders with role="alert"
      const alertElements = screen.getAllByRole('alert');
      expect(alertElements).toHaveLength(2);
    });

    it('shows cost threshold alert title', async () => {
      setupMocks({ alerts: testAlerts });
      await renderPage();

      expect(screen.getByText('Cost threshold exceeded')).toBeInTheDocument();
    });

    it('shows anomaly alert title', async () => {
      setupMocks({ alerts: testAlerts });
      await renderPage();

      expect(screen.getByText('Usage anomaly detected')).toBeInTheDocument();
    });

    it('does not show alert banners when no alerts', async () => {
      setupMocks({ alerts: [] });
      await renderPage();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('dismisses alert when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      setupMocks({ alerts: testAlerts });
      await renderPage();

      // Find dismiss button for first alert (aria-label="Dismiss alert")
      const dismissButtons = screen.getAllByLabelText('Dismiss alert');
      expect(dismissButtons.length).toBeGreaterThanOrEqual(1);
      await user.click(dismissButtons[0]!);

      // After dismiss, only 1 alert should remain
      const remainingAlerts = screen.getAllByRole('alert');
      expect(remainingAlerts).toHaveLength(1);
    });
  });

  // --- Empty state ---

  describe('empty state', () => {
    it('shows skeleton cards when summary data is null', async () => {
      setupMocks({ summary: null });
      await renderPage();

      // When summary is undefined/null, SummaryCards renders 4 Skeleton elements
      // The summary metric labels should not be present
      expect(screen.queryByText('analytics.totalTokens')).not.toBeInTheDocument();
      expect(screen.queryByText('analytics.totalCost')).not.toBeInTheDocument();
    });
  });

  // --- Export ---

  describe('export', () => {
    it('clicking Export CSV calls export mutation', async () => {
      const user = userEvent.setup();
      await renderPage();

      const exportButton = screen.getByText('analytics.exportCsv');
      await user.click(exportButton);

      expect(mockExportMutate).toHaveBeenCalledOnce();
    });
  });
});

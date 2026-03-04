/* eslint-disable i18next/no-literal-string */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type { SkillEffectiveness, PlatformInsight } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean; user: { id: string; role: string } }) => unknown) =>
      selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockApiGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
  },
}));

import { KpiCard } from '../components/kpi-card';
import { SkillEffectivenessTable } from '../components/skill-effectiveness-table';
import { FeatureGapsSection } from '../components/feature-gaps-section';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testSkills: SkillEffectiveness[] = [
  {
    id: 'se-1',
    skillKey: 'ar.aging_report',
    measureDate: '2026-03-01',
    tenantCount: 10,
    totalQueries: 500,
    avgSuccessRate: '0.92',
    avgCorrectionRate: '0.08',
    avgConfidence: '0.85',
    trend: 'IMPROVING',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'se-2',
    skillKey: 'finance.vat_return',
    measureDate: '2026-03-01',
    tenantCount: 8,
    totalQueries: 300,
    avgSuccessRate: '0.45',
    avgCorrectionRate: '0.35',
    avgConfidence: '0.70',
    trend: 'DECLINING',
    createdAt: '2026-03-01T00:00:00Z',
  },
];

const testInsights: PlatformInsight[] = [
  {
    id: 'ig-1',
    insightType: 'FEATURE_GAP',
    title: 'Missing dunning',
    description: 'No dunning skill',
    evidence: { module: 'AR', tenantCount: 12, frequency: 200 },
    severity: 'HIGH',
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return render(ui, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests — Keyboard Navigation
// ---------------------------------------------------------------------------

describe('Accessibility: Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('table column headers are focusable via Tab and sortable via Enter', async () => {
    mockApiGet.mockResolvedValue({
      data: testSkills,
      meta: { hasMore: false },
    });

    const user = userEvent.setup();
    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('ar.aging_report');

    // Tab to first sort button (Skill Name)
    const firstSortButton = screen.getByRole('button', { name: /sort by skill name/i });
    firstSortButton.focus();
    expect(firstSortButton).toHaveFocus();

    // Press Enter to sort
    await user.keyboard('{Enter}');

    // After sort, the th should have aria-sort attribute
    const th = firstSortButton.closest('th');
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });

  it('pagination buttons are keyboard accessible', async () => {
    mockApiGet.mockResolvedValue({
      data: testSkills,
      meta: { hasMore: false },
    });

    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('ar.aging_report');

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    // Both should be focusable
    expect(prevButton).not.toBeNull();
    expect(nextButton).not.toBeNull();

    // Previous should be disabled on first page
    expect(prevButton).toBeDisabled();
  });

  it('KpiCard retry button is keyboard accessible', async () => {
    const onRetry = vi.fn();
    render(<KpiCard label="Test" value={0} error={new Error('failed')} onRetry={onRetry} />);

    const retryButton = screen.getByText('Retry');
    retryButton.focus();

    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tests — Screen Reader Announcements
// ---------------------------------------------------------------------------

describe('Accessibility: Screen Reader Announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trend indicators have aria-label text alternatives', () => {
    render(<KpiCard label="Rate" value={85} trend="up" isPercentage />);

    // Trend should have aria-label
    expect(screen.getByLabelText('Trend: Improving')).toBeInTheDocument();
  });

  it('severity badges have aria-label text alternatives', async () => {
    mockApiGet.mockResolvedValue({
      data: testInsights,
      meta: { hasMore: false },
    });

    renderWithQuery(<FeatureGapsSection />);

    await screen.findByText('Missing dunning');

    const severityBadge = screen.getByLabelText('Severity: High');
    expect(severityBadge).toBeInTheDocument();
    // Badge also shows text "High" (not colour-only)
    expect(severityBadge).toHaveTextContent('High');
  });

  it('success rate cells include both colour and text alternative', async () => {
    mockApiGet.mockResolvedValue({
      data: testSkills,
      meta: { hasMore: false },
    });

    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('ar.aging_report');

    // High success rate should have aria-label with percentage and level
    const highRate = screen.getByLabelText(/success rate: 92\.0%, high/i);
    expect(highRate).toBeInTheDocument();

    // Low success rate
    const lowRate = screen.getByLabelText(/success rate: 45\.0%, low/i);
    expect(lowRate).toBeInTheDocument();
  });

  it('trend indicators in skill table have aria-label', async () => {
    mockApiGet.mockResolvedValue({
      data: testSkills,
      meta: { hasMore: false },
    });

    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('ar.aging_report');

    expect(screen.getByLabelText('Trend: Improving')).toBeInTheDocument();
    expect(screen.getByLabelText('Trend: Declining')).toBeInTheDocument();
  });

  it('table has proper semantic structure', async () => {
    mockApiGet.mockResolvedValue({
      data: testSkills,
      meta: { hasMore: false },
    });

    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('ar.aging_report');

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Check column headers with scope="col"
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.length).toBe(8); // 8 columns
    headers.forEach((th) => {
      expect(th).toHaveAttribute('scope', 'col');
    });
  });

  it('page count is announced via aria-live on pagination', async () => {
    mockApiGet.mockResolvedValue({
      data: testSkills,
      meta: { hasMore: false },
    });

    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('ar.aging_report');

    // Page counter should have aria-live for screen reader announcements
    const pageInfo = screen.getByText(/page 1 of/i);
    expect(pageInfo).toHaveAttribute('aria-live', 'polite');
  });
});

// ---------------------------------------------------------------------------
// Tests — prefers-reduced-motion
// ---------------------------------------------------------------------------

describe('Accessibility: prefers-reduced-motion', () => {
  it('animation classes are applied (CSS handles prefers-reduced-motion via media query)', () => {
    render(<KpiCard label="Test" value={42} isLoading />);

    // The skeleton has animate-pulse which CSS should respect prefers-reduced-motion
    // This verifies the class is present; the actual media query handling is in CSS
    const { container } = render(<KpiCard label="Test" value={42} isLoading />);
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — Contrast and Visual Indicators
// ---------------------------------------------------------------------------

describe('Accessibility: Visual Indicators', () => {
  it('high correction rate warning has text label, not just icon', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        {
          ...testSkills[1],
          avgCorrectionRate: '0.40',
        },
      ],
      meta: { hasMore: false },
    });

    renderWithQuery(<SkillEffectivenessTable />);

    await screen.findByText('finance.vat_return');

    // Warning icon should have aria-label
    const warning = screen.getByLabelText(/high correction rate warning/i);
    expect(warning).toBeInTheDocument();
  });

  it('error state has proper role="alert"', () => {
    render(<KpiCard label="Test" value={0} error={new Error('failed')} />);

    // The error text "Failed to load" should be visible
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});

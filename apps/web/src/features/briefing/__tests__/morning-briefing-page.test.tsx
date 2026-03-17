/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type {
  UrgencyCard,
  BriefingKpi,
  BriefingRecommendation,
  BriefingScheduleItem,
  BriefingData,
} from '../api/use-briefing';

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
  useAuthStore: vi.fn(
    (
      selector: (s: {
        isAuthenticated: boolean;
        user: { firstName: string; lastName: string };
      }) => unknown,
    ) => selector({ isAuthenticated: true, user: { firstName: 'Mohammed', lastName: 'Hussein' } }),
  ),
}));

// --- Mock use-briefing hook ---
const mockUseBriefing = vi.fn();
vi.mock('../api/use-briefing', () => ({
  useBriefing: () => mockUseBriefing(),
  // Re-export transformBriefingItems (not tested here, but needed for type-checks)
  transformBriefingItems: vi.fn(),
}));

// --- Test data ---
const testBriefingData: BriefingData = {
  generatedAt: '2026-03-17T08:00:00Z',
  userId: 'user-1',
  role: 'OWNER',
  greeting: 'Good morning, Mohammed!',
  summary: 'You have 3 urgent tasks today.',
  items: [],
  isStale: false,
};

const testUrgencyCards: UrgencyCard[] = [
  {
    id: 'card-1',
    type: 'overdue',
    title: 'Overdue Invoices',
    detail: '5 invoices are overdue',
    count: 5,
    actions: [{ label: 'View Invoices', actionType: 'navigate', route: '/ar/invoices' }],
    priority: 'high',
  },
  {
    id: 'card-2',
    type: 'approval',
    title: 'Pending Approvals',
    detail: '2 purchase orders awaiting approval',
    count: 2,
    actions: [{ label: 'Review', actionType: 'approve' }],
    priority: 'medium',
  },
];

const testKpis: BriefingKpi[] = [
  {
    key: 'kpi-1',
    label: 'Cash Position',
    value: '£45,000',
    trend: { direction: 'up', value: '+£5,000', positive: true },
  },
  {
    key: 'kpi-2',
    label: 'Overdue Balance',
    value: '£12,500',
    trend: { direction: 'up', value: '+£2,500', positive: false },
  },
];

const testRecommendations: BriefingRecommendation[] = [
  {
    id: 'rec-1',
    title: 'Chase overdue invoices',
    detail: 'Send reminders to customers with invoices overdue by more than 30 days',
    actions: [{ label: 'Send Reminders', actionType: 'chase', route: '/ar/invoices' }],
  },
];

const testScheduleItems: BriefingScheduleItem[] = [
  {
    id: 'sched-1',
    time: '10:00',
    title: 'Monthly review',
    detail: 'Review monthly financials',
    status: 'upcoming',
  },
];

function setupMock(
  overrides: Partial<{
    briefing: BriefingData | null;
    urgencyCards: UrgencyCard[];
    kpis: BriefingKpi[];
    recommendations: BriefingRecommendation[];
    scheduleItems: BriefingScheduleItem[];
    isLoading: boolean;
    refetch: () => void;
  }> = {},
) {
  mockUseBriefing.mockReturnValue({
    briefing: testBriefingData,
    urgencyCards: testUrgencyCards,
    kpis: testKpis,
    recommendations: testRecommendations,
    scheduleItems: testScheduleItems,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

async function renderPage() {
  const { MorningBriefingPage } = await import('../morning-briefing-page');
  return render(<MorningBriefingPage />);
}

describe('MorningBriefingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock();
  });

  // --- Loading state ---

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', async () => {
      setupMock({ isLoading: true });
      await renderPage();

      // BriefingSkeleton renders a div with aria-busy="true"
      const busyEl = document.querySelector('[aria-busy="true"]');
      expect(busyEl).toBeTruthy();
    });

    it('does not render greeting when loading', async () => {
      setupMock({ isLoading: true });
      await renderPage();

      expect(screen.queryByText('Good morning, Mohammed!')).not.toBeInTheDocument();
    });
  });

  // --- Greeting ---

  describe('greeting', () => {
    it('renders greeting from briefing data', async () => {
      await renderPage();

      expect(screen.getByText('Good morning, Mohammed!')).toBeInTheDocument();
    });

    it('renders fallback greeting key when briefing data has no greeting', async () => {
      setupMock({
        briefing: { ...testBriefingData, greeting: '' },
      });
      await renderPage();

      // When greeting is empty string (falsy), falls back to i18n key
      // The mock returns key as value, so look for a greeting key
      // hour-dependent: briefing.greeting.morning / afternoon / evening
      const greetingEl = screen.getByRole('heading', { level: 1 });
      expect(greetingEl).toBeInTheDocument();
    });

    it('renders briefing subtitle / summary', async () => {
      await renderPage();

      // The summary text appears inside a <p> alongside the date and separator
      // Use a regex to find it without requiring exact full text match
      expect(screen.getByText(/You have 3 urgent tasks today\./)).toBeInTheDocument();
    });
  });

  // --- Urgency cards ---

  describe('urgency cards', () => {
    it('renders urgency cards when present', async () => {
      await renderPage();

      // UrgencyCard renders with role="article" and aria-label=card.title
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(testUrgencyCards.length);
    });

    it('renders urgency card titles', async () => {
      await renderPage();

      expect(screen.getByText('Overdue Invoices')).toBeInTheDocument();
      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    });

    it('renders urgency type i18n keys in badge aria-labels', async () => {
      await renderPage();

      // Badge aria-label = "{count} {t('briefing.urgency.overdue')}"
      // i18n mock returns key, so: "5 briefing.urgency.overdue"
      expect(screen.getByLabelText('5 briefing.urgency.overdue')).toBeInTheDocument();
      expect(screen.getByLabelText('2 briefing.urgency.approval')).toBeInTheDocument();
    });

    it('does not render urgency section when no urgency cards', async () => {
      setupMock({ urgencyCards: [] });
      await renderPage();

      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });
  });

  // --- KPI row ---

  describe('KPI row', () => {
    it('renders KPI labels when present', async () => {
      await renderPage();

      expect(screen.getByText('Cash Position')).toBeInTheDocument();
      expect(screen.getByText('Overdue Balance')).toBeInTheDocument();
    });

    it('renders KPI values', async () => {
      await renderPage();

      expect(screen.getByText('£45,000')).toBeInTheDocument();
      expect(screen.getByText('£12,500')).toBeInTheDocument();
    });

    it('does not render KPI section when no KPIs', async () => {
      setupMock({ kpis: [] });
      await renderPage();

      // KPI labels should not appear
      expect(screen.queryByText('Cash Position')).not.toBeInTheDocument();
    });
  });

  // --- Recommendations panel ---

  describe('recommendations panel', () => {
    it('renders recommendations panel heading', async () => {
      await renderPage();

      expect(screen.getByText('briefing.recommendations')).toBeInTheDocument();
    });

    it('renders recommendation titles', async () => {
      await renderPage();

      expect(screen.getByText('Chase overdue invoices')).toBeInTheDocument();
    });

    it('renders empty recommendations message when no recommendations', async () => {
      setupMock({ recommendations: [] });
      await renderPage();

      expect(screen.getByText('briefing.noItems')).toBeInTheDocument();
    });
  });

  // --- Refresh ---

  describe('refresh', () => {
    it('renders Refresh now button', async () => {
      await renderPage();

      expect(screen.getByText('briefing.refreshNow')).toBeInTheDocument();
    });

    it('clicking Refresh now calls refetch', async () => {
      const mockRefetch = vi.fn();
      const user = userEvent.setup();
      setupMock({ refetch: mockRefetch });
      await renderPage();

      const refreshButton = screen.getByText('briefing.refreshNow');
      await user.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('renders lastRefreshed text when generatedAt is set', async () => {
      await renderPage();

      // lastRefreshed is a text node alongside the separator and refreshNow button
      // Use queryAllByText with a regex to find it across text nodes
      expect(screen.getByText(/briefing\.lastRefreshed/)).toBeInTheDocument();
    });

    it('renders stale warning when briefing is stale', async () => {
      setupMock({ briefing: { ...testBriefingData, isStale: true } });
      await renderPage();

      expect(screen.getByText('(briefing.staleWarning)')).toBeInTheDocument();
    });
  });
});

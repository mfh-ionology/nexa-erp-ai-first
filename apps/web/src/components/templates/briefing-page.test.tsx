import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BriefingPage } from './briefing-page';
import type { BriefingCardConfig, SummaryMetric } from './types';

// Mock useBreakpoint to default to desktop
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

const mockCards: BriefingCardConfig[] = [
  {
    id: 'kpi1',
    type: 'kpi',
    titleKey: 'briefing.revenue',
    value: '50000',
    previousValue: '45000',
    format: 'currency',
  },
  {
    id: 'action1',
    type: 'action',
    titleKey: 'briefing.pendingInvoices',
    value: '3',
    description: 'Invoices awaiting approval',
    actionLabelKey: 'briefing.review',
    onAction: vi.fn(),
  },
  {
    id: 'alert1',
    type: 'alert',
    titleKey: 'briefing.overduePayments',
    description: '2 payments overdue',
    severity: 'warning',
    actionLabelKey: 'briefing.viewAll',
    onAction: vi.fn(),
  },
];

const mockMetrics: SummaryMetric[] = [
  { labelKey: 'metric.revenue', value: '50000', previousValue: '45000', format: 'currency', trend: 'up' },
  { labelKey: 'metric.expenses', value: '30000', previousValue: '32000', format: 'currency', trend: 'down' },
];

const defaultProps = {
  title: 'The Briefing',
  breadcrumbs: [{ label: 'Home' }],
  cards: mockCards,
};

describe('BriefingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders greeting with user name', () => {
    render(
      <BriefingPage
        {...defaultProps}
        greetingKey="briefing.greeting"
        userName="Mohammed"
      />,
    );

    expect(screen.getByText('briefing.greeting')).toBeInTheDocument();
  });

  it('renders summary metrics', () => {
    render(
      <BriefingPage
        {...defaultProps}
        cards={[]} // No cards to avoid value collisions with metrics
        summaryMetrics={mockMetrics}
      />,
    );

    expect(screen.getByText('metric.revenue')).toBeInTheDocument();
    expect(screen.getByText('metric.expenses')).toBeInTheDocument();
    expect(screen.getByText('50000')).toBeInTheDocument();
    expect(screen.getByText('30000')).toBeInTheDocument();
  });

  it('renders all card types', () => {
    render(<BriefingPage {...defaultProps} />);

    // KPI card
    expect(screen.getByText('briefing.revenue')).toBeInTheDocument();

    // Action card
    expect(screen.getByText('briefing.pendingInvoices')).toBeInTheDocument();
    expect(screen.getByText('Invoices awaiting approval')).toBeInTheDocument();

    // Alert card
    expect(screen.getByText('briefing.overduePayments')).toBeInTheDocument();
    expect(screen.getByText('2 payments overdue')).toBeInTheDocument();
  });

  it('card action triggers onAction callback', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    const cards: BriefingCardConfig[] = [
      {
        id: 'action1',
        type: 'action',
        titleKey: 'briefing.pendingInvoices',
        actionLabelKey: 'briefing.review',
        onAction,
      },
    ];

    render(<BriefingPage {...defaultProps} cards={cards} />);

    await user.click(screen.getByText('briefing.review'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('has semantic main landmark with aria-label', () => {
    render(<BriefingPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'The Briefing');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<BriefingPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });
});

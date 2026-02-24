import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RecordDetailPage } from './record-detail-page';

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

const defaultProps = {
  title: 'Customer Detail',
  breadcrumbs: [
    { label: 'Home', path: '/' },
    { label: 'Customers', path: '/customers' },
    { label: 'Acme Corp' },
  ],
  entityType: 'customer',
  tabs: [
    { key: 'primary', labelKey: 'tabs.primary', content: <div>Primary content</div> },
    { key: 'details', labelKey: 'tabs.details', content: <div>Details content</div> },
    { key: 'financial', labelKey: 'tabs.financial', content: <div>Financial content</div> },
  ],
};

describe('RecordDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title with status badge', () => {
    render(
      <RecordDetailPage {...defaultProps} status="APPROVED" />,
    );

    expect(screen.getByText('Customer Detail')).toBeInTheDocument();
    // StatusBadge renders with ARIA label
    expect(screen.getByLabelText('status.ariaLabel')).toBeInTheDocument();
  });

  it('renders title without status badge when no status provided', () => {
    render(<RecordDetailPage {...defaultProps} />);

    expect(screen.getByText('Customer Detail')).toBeInTheDocument();
    expect(screen.queryByLabelText('status.ariaLabel')).not.toBeInTheDocument();
  });

  it('renders tabs and switches tab content on click', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <RecordDetailPage {...defaultProps} onTabChange={onTabChange} />,
    );

    // First tab content should be visible (default active tab)
    expect(screen.getByText('Primary content')).toBeInTheDocument();

    // Click second tab
    await user.click(screen.getByRole('tab', { name: 'tabs.details' }));
    expect(onTabChange).toHaveBeenCalledWith('details');
  });

  it('renders related entities with correct counts', () => {
    render(
      <RecordDetailPage
        {...defaultProps}
        relatedEntities={[
          { key: 'invoices', labelKey: 'related.invoices', count: 5, path: '/invoices' },
          { key: 'orders', labelKey: 'related.orders', count: 12, path: '/orders' },
        ]}
      />,
    );

    expect(screen.getByText('related.invoices')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('related.orders')).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('action bar slot renders provided content', () => {
    render(
      <RecordDetailPage
        {...defaultProps}
        actionBarSlot={<button type="button">Edit Record</button>}
      />,
    );

    expect(screen.getByText('Edit Record')).toBeInTheDocument();
  });

  it('renders event flow slot when provided', () => {
    render(
      <RecordDetailPage
        {...defaultProps}
        eventFlowSlot={<div data-testid="event-flow">Event Flow Tracker</div>}
      />,
    );

    expect(screen.getByTestId('event-flow')).toBeInTheDocument();
  });

  it('has semantic main landmark with aria-label', () => {
    render(<RecordDetailPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Customer Detail');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<RecordDetailPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });

  it('renders breadcrumbs correctly', () => {
    render(<RecordDetailPage {...defaultProps} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StatusBadge } from './status-badge';

// Mock useBreakpoint (not directly used, but may be in imports)
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

describe('StatusBadge', () => {
  it('renders correct label for DRAFT status', () => {
    render(<StatusBadge status="DRAFT" entityType="invoice" />);

    expect(screen.getByText('status.draft')).toBeInTheDocument();
  });

  it('renders correct label for POSTED status', () => {
    render(<StatusBadge status="POSTED" entityType="invoice" />);

    expect(screen.getByText('status.posted')).toBeInTheDocument();
  });

  it('renders correct label for APPROVED status', () => {
    render(<StatusBadge status="APPROVED" entityType="order" />);

    expect(screen.getByText('status.approved')).toBeInTheDocument();
  });

  it('renders correct label for VOID status', () => {
    render(<StatusBadge status="VOID" entityType="invoice" />);

    expect(screen.getByText('status.void')).toBeInTheDocument();
  });

  it('renders correct label for IN_PROGRESS status', () => {
    render(<StatusBadge status="IN_PROGRESS" entityType="order" />);

    expect(screen.getByText('status.inProgress')).toBeInTheDocument();
  });

  it('renders correct label for AWAITING_APPROVAL status', () => {
    render(<StatusBadge status="AWAITING_APPROVAL" entityType="invoice" />);

    expect(screen.getByText('status.awaitingApproval')).toBeInTheDocument();
  });

  it('renders correct label for CANCELLED status', () => {
    render(<StatusBadge status="CANCELLED" entityType="order" />);

    expect(screen.getByText('status.cancelled')).toBeInTheDocument();
  });

  it('renders correct label for OVERDUE status', () => {
    render(<StatusBadge status="OVERDUE" entityType="invoice" />);

    expect(screen.getByText('status.overdue')).toBeInTheDocument();
  });

  it('renders correct label for REJECTED status', () => {
    render(<StatusBadge status="REJECTED" entityType="invoice" />);

    expect(screen.getByText('status.rejected')).toBeInTheDocument();
  });

  it('renders correct label for CLOSED status', () => {
    render(<StatusBadge status="CLOSED" entityType="order" />);

    expect(screen.getByText('status.closed')).toBeInTheDocument();
  });

  it('falls back to default styling for unknown status strings', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" entityType="invoice" />);

    // Unknown status should render with the default label key
    expect(screen.getByText('status.unknown')).toBeInTheDocument();
  });

  it('ARIA label includes the status text', () => {
    render(<StatusBadge status="DRAFT" entityType="invoice" />);

    const badge = screen.getByLabelText('status.ariaLabel');
    expect(badge).toBeInTheDocument();
  });

  it('renders data attributes for entity type and status', () => {
    render(<StatusBadge status="POSTED" entityType="invoice" />);

    const badge = screen.getByLabelText('status.ariaLabel');
    expect(badge).toHaveAttribute('data-entity-type', 'invoice');
    expect(badge).toHaveAttribute('data-status', 'POSTED');
  });

  it('renders with different size variants', () => {
    const { rerender } = render(
      <StatusBadge status="DRAFT" entityType="invoice" size="sm" />,
    );

    expect(screen.getByLabelText('status.ariaLabel')).toBeInTheDocument();

    rerender(
      <StatusBadge status="DRAFT" entityType="invoice" size="lg" />,
    );

    expect(screen.getByLabelText('status.ariaLabel')).toBeInTheDocument();
  });

  it('renders icon for the status', () => {
    render(<StatusBadge status="APPROVED" entityType="order" />);

    // The icon is rendered with aria-hidden="true"
    const badge = screen.getByLabelText('status.ariaLabel');
    const icon = badge.querySelector('svg');
    expect(icon).toBeTruthy();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

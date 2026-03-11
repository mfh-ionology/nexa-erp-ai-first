// ---------------------------------------------------------------------------
// Tests — StatusBadge component
// Story: E13b.2 Task 7.6
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  describe('tenant status', () => {
    it.each([
      { status: 'ACTIVE' as const, label: 'Active', colorClass: 'text-green-600' },
      { status: 'SUSPENDED' as const, label: 'Suspended', colorClass: 'text-red-600' },
      { status: 'READ_ONLY' as const, label: 'Read Only', colorClass: 'text-amber-500' },
      { status: 'ARCHIVED' as const, label: 'Archived', colorClass: 'text-slate-400' },
      { status: 'PROVISIONING' as const, label: 'Provisioning', colorClass: 'text-slate-500' },
    ])('renders "$label" with $colorClass for $status', ({ status, label, colorClass }) => {
      render(<StatusBadge status={status} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass(colorClass);
    });
  });

  describe('billing status', () => {
    it.each([
      { billingStatus: 'CURRENT' as const, label: 'Current', colorClass: 'text-green-600' },
      { billingStatus: 'GRACE' as const, label: 'Grace', colorClass: 'text-amber-500' },
      { billingStatus: 'OVERDUE' as const, label: 'Overdue', colorClass: 'text-red-500' },
      { billingStatus: 'BLOCKED' as const, label: 'Blocked', colorClass: 'text-red-700' },
    ])(
      'renders "$label" with $colorClass for $billingStatus',
      ({ billingStatus, label, colorClass }) => {
        render(<StatusBadge billingStatus={billingStatus} />);

        const badge = screen.getByText(label);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass(colorClass);
      },
    );
  });

  it('renders a coloured dot indicator', () => {
    const { container } = render(<StatusBadge status="ACTIVE" />);

    const dot = container.querySelector('.rounded-full.bg-green-600');
    expect(dot).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusBadge status="ACTIVE" className="mt-2" />);

    const badge = screen.getByText('Active');
    expect(badge).toHaveClass('mt-2');
  });
});

/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Users } from 'lucide-react';

import { KpiCard } from '../components/kpi-card';

describe('KpiCard', () => {
  it('renders label, value, and trend indicator correctly', () => {
    render(
      <KpiCard
        label="Contributing Tenants"
        value={1234}
        trend="up"
        trendValue="+12%"
        icon={Users}
      />,
    );

    expect(screen.getByText('Contributing Tenants')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('formats percentage values with 1 decimal place', () => {
    render(<KpiCard label="AI Success Rate" value={87.543} isPercentage />);

    expect(screen.getByText('87.5%')).toBeInTheDocument();
  });

  it('displays dash for null values', () => {
    render(<KpiCard label="Test Metric" value={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<KpiCard label="Test" value={0} isLoading />);

    // Skeleton shows pulsing elements, not the label/value
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('shows error state with retry button', async () => {
    const onRetry = vi.fn();
    render(
      <KpiCard
        label="Failed Metric"
        value={0}
        error={new Error('fetch failed')}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Failed Metric')).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry');
    await userEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has aria-label on trend indicator for accessibility', () => {
    render(<KpiCard label="Test" value={100} trend="down" />);

    expect(screen.getByLabelText('Trend: Declining')).toBeInTheDocument();
  });

  it('shows "Improving" text for up trend alongside colour indicator', () => {
    render(<KpiCard label="Test" value={100} trend="up" />);

    // Both visible text and sr-only text should exist
    const trendElements = screen.getAllByText('Improving');
    expect(trendElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Stable" text for stable trend alongside colour indicator', () => {
    render(<KpiCard label="Test" value={100} trend="stable" />);

    const trendElements = screen.getAllByText('Stable');
    expect(trendElements.length).toBeGreaterThanOrEqual(1);
  });

  it('formats large numbers with locale separators', () => {
    render(<KpiCard label="Total" value={1000000} />);

    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });
});

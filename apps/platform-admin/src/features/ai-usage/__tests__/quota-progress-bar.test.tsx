// ---------------------------------------------------------------------------
// Component Tests — Quota Progress Bar
// Story E13b-4 Task 6.5 (AC#2)
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { QuotaProgressBar } from '../components/quota-progress-bar';

describe('QuotaProgressBar', () => {
  // -------------------------------------------------------------------------
  // Rendering at different quota levels
  // -------------------------------------------------------------------------

  it('renders label with tokens used, allowance, and percentage', () => {
    render(<QuotaProgressBar tokensUsed={600_000} tokenAllowance={2_000_000} />);

    expect(screen.getByTestId('quota-label')).toHaveTextContent('600.0K / 2.0M tokens (30.0%)');
  });

  it('renders green bar at 30% (below soft limit)', () => {
    const { container } = render(
      <QuotaProgressBar tokensUsed={600_000} tokenAllowance={2_000_000} />,
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveClass('bg-emerald-500');
    expect(progressBar).toHaveStyle({ width: '30%' });
  });

  it('renders amber bar at 85% (at soft limit)', () => {
    const { container } = render(
      <QuotaProgressBar
        tokensUsed={1_700_000}
        tokenAllowance={2_000_000}
        softLimitPct={80}
        hardLimitPct={100}
      />,
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveClass('bg-amber-500');
  });

  it('renders red bar at 105% (above hard limit)', () => {
    const { container } = render(
      <QuotaProgressBar
        tokensUsed={2_100_000}
        tokenAllowance={2_000_000}
        softLimitPct={80}
        hardLimitPct={100}
      />,
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveClass('bg-red-600');
    // Capped at 100% width even though usage is 105%
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  it('renders label correctly at 105%', () => {
    render(<QuotaProgressBar tokensUsed={2_100_000} tokenAllowance={2_000_000} />);

    expect(screen.getByTestId('quota-label')).toHaveTextContent('2.1M / 2.0M tokens (105.0%)');
  });

  // -------------------------------------------------------------------------
  // Limit markers
  // -------------------------------------------------------------------------

  it('renders soft limit marker at 80%', () => {
    render(<QuotaProgressBar tokensUsed={500_000} tokenAllowance={2_000_000} softLimitPct={80} />);

    const softMarker = screen.getByTestId('soft-limit-marker');
    expect(softMarker).toHaveStyle({ left: '80%' });
    expect(softMarker).toHaveAttribute('title', 'Soft limit: 80%');
  });

  it('renders hard limit marker at 100%', () => {
    render(<QuotaProgressBar tokensUsed={500_000} tokenAllowance={2_000_000} hardLimitPct={100} />);

    const hardMarker = screen.getByTestId('hard-limit-marker');
    expect(hardMarker).toHaveStyle({ left: '100%' });
    expect(hardMarker).toHaveAttribute('title', 'Hard limit: 100%');
  });

  // -------------------------------------------------------------------------
  // Custom thresholds
  // -------------------------------------------------------------------------

  it('respects custom soft and hard limits', () => {
    const { container } = render(
      <QuotaProgressBar
        tokensUsed={720_000}
        tokenAllowance={1_000_000}
        softLimitPct={70}
        hardLimitPct={90}
      />,
    );

    // 72% usage is above the custom 70% soft limit → amber
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveClass('bg-amber-500');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles zero allowance gracefully', () => {
    render(<QuotaProgressBar tokensUsed={0} tokenAllowance={0} />);

    expect(screen.getByTestId('quota-label')).toHaveTextContent('0 / 0 tokens (0.0%)');
  });

  it('has correct ARIA attributes', () => {
    const { container } = render(
      <QuotaProgressBar tokensUsed={1_200_000} tokenAllowance={2_000_000} />,
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'Token usage: 60.0%');
  });

  it('renders legend text', () => {
    render(
      <QuotaProgressBar
        tokensUsed={500_000}
        tokenAllowance={2_000_000}
        softLimitPct={80}
        hardLimitPct={100}
      />,
    );

    expect(screen.getByText(/Soft limit \(80%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Hard limit \(100%\)/)).toBeInTheDocument();
  });
});

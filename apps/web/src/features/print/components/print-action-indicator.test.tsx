/* eslint-disable i18next/no-literal-string */

/**
 * Tests for <PrintActionIndicator>.
 *
 * Covers Task 4.4:
 * - Visibility based on isPrinting prop
 * - Animation class application
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PrintActionIndicator } from './print-action-indicator';

describe('PrintActionIndicator', () => {
  it('is visible when isPrinting is true', () => {
    render(<PrintActionIndicator isPrinting={true} />);

    const indicator = screen.getByTestId('print-action-indicator');
    expect(indicator).toHaveClass('opacity-100');
    expect(indicator).not.toHaveClass('opacity-0');
    expect(indicator).toHaveAttribute('aria-hidden', 'false');
  });

  it('is hidden when isPrinting is false', () => {
    render(<PrintActionIndicator isPrinting={false} />);

    const indicator = screen.getByTestId('print-action-indicator');
    expect(indicator).toHaveClass('opacity-0');
    expect(indicator).toHaveClass('pointer-events-none');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies spin animation when printing', () => {
    render(<PrintActionIndicator isPrinting={true} />);

    const indicator = screen.getByTestId('print-action-indicator');
    const svg = indicator.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass('animate-spin');
  });

  it('does not apply spin animation when not printing', () => {
    render(<PrintActionIndicator isPrinting={false} />);

    const indicator = screen.getByTestId('print-action-indicator');
    const svg = indicator.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).not.toHaveClass('animate-spin');
  });

  it('includes motion-reduce classes for accessibility', () => {
    render(<PrintActionIndicator isPrinting={true} />);

    const indicator = screen.getByTestId('print-action-indicator');
    expect(indicator).toHaveClass('motion-reduce:transition-none');

    const svg = indicator.querySelector('svg');
    expect(svg).toHaveClass('motion-reduce:animate-none');
  });
});

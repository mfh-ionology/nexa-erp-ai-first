import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { FieldVisibilityMap } from '@/hooks/use-field-visibility';

import { PermissionField } from './permission-field';

describe('PermissionField', () => {
  it('renders children when visibility is VISIBLE', () => {
    const visibility: FieldVisibilityMap = { testField: 'VISIBLE' };

    render(
      <PermissionField fieldPath="testField" visibility={visibility}>
        <input data-testid="field-input" />
      </PermissionField>,
    );

    expect(screen.getByTestId('field-input')).toBeInTheDocument();
  });

  it('renders children when field is not in visibility map (defaults to VISIBLE)', () => {
    const visibility: FieldVisibilityMap = {};

    render(
      <PermissionField fieldPath="unknownField" visibility={visibility}>
        <input data-testid="field-input" />
      </PermissionField>,
    );

    expect(screen.getByTestId('field-input')).toBeInTheDocument();
  });

  it('renders nothing when visibility is HIDDEN', () => {
    const visibility: FieldVisibilityMap = { costPrice: 'HIDDEN' };

    const { container } = render(
      <PermissionField fieldPath="costPrice" visibility={visibility}>
        <input data-testid="field-input" />
      </PermissionField>,
    );

    expect(screen.queryByTestId('field-input')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('renders disabled children when visibility is READ_ONLY', () => {
    const visibility: FieldVisibilityMap = { discountPercent: 'READ_ONLY' };

    render(
      <PermissionField fieldPath="discountPercent" visibility={visibility}>
        <input data-testid="field-input" />
      </PermissionField>,
    );

    const input = screen.getByTestId('field-input');
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('adds aria-readonly for READ_ONLY fields', () => {
    const visibility: FieldVisibilityMap = { discountPercent: 'READ_ONLY' };

    render(
      <PermissionField fieldPath="discountPercent" visibility={visibility}>
        <input data-testid="field-input" />
      </PermissionField>,
    );

    const input = screen.getByTestId('field-input');
    expect(input).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not add disabled or aria-readonly for VISIBLE fields', () => {
    const visibility: FieldVisibilityMap = { testField: 'VISIBLE' };

    render(
      <PermissionField fieldPath="testField" visibility={visibility}>
        <input data-testid="field-input" />
      </PermissionField>,
    );

    const input = screen.getByTestId('field-input');
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute('aria-readonly');
  });

  it('handles multiple children for READ_ONLY', () => {
    const visibility: FieldVisibilityMap = { testField: 'READ_ONLY' };

    render(
      <PermissionField fieldPath="testField" visibility={visibility}>
        <input data-testid="input-1" />
        <input data-testid="input-2" />
      </PermissionField>,
    );

    expect(screen.getByTestId('input-1')).toBeDisabled();
    expect(screen.getByTestId('input-2')).toBeDisabled();
  });

  it('handles plain text children for READ_ONLY without crashing', () => {
    const visibility: FieldVisibilityMap = { testField: 'READ_ONLY' };

    const { container } = render(
      <PermissionField fieldPath="testField" visibility={visibility}>
        Some text content
      </PermissionField>,
    );

    expect(container.textContent).toBe('Some text content');
  });
});

/* eslint-disable i18next/no-literal-string */
// ---------------------------------------------------------------------------
// Frontend component tests — E10-3 Task 10.5 (EmailRecipientField)
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { EmailRecipientField } from './email-recipient-field';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderField(props: Partial<Parameters<typeof EmailRecipientField>[0]> = {}) {
  const defaultProps = {
    value: [] as string[],
    onChange: vi.fn(),
    placeholder: 'Add email address',
    ...props,
  };
  return { ...render(<EmailRecipientField {...defaultProps} />), onChange: defaultProps.onChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailRecipientField', () => {
  it('renders with placeholder when empty', () => {
    renderField();
    expect(screen.getByPlaceholderText('Add email address')).toBeInTheDocument();
  });

  it('adds email chip on Enter key', async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    const input = screen.getByPlaceholderText('Add email address');
    await user.type(input, 'test@example.com{Enter}');

    expect(onChange).toHaveBeenCalledWith(['test@example.com']);
  });

  it('adds email chip on comma key', async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    const input = screen.getByPlaceholderText('Add email address');
    await user.type(input, 'test@example.com,');

    expect(onChange).toHaveBeenCalledWith(['test@example.com']);
  });

  it('renders existing email chips', () => {
    renderField({ value: ['a@example.com', 'b@example.com'] });
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('b@example.com')).toBeInTheDocument();
  });

  it('removes email chip via remove button', async () => {
    const user = userEvent.setup();
    const { onChange } = renderField({ value: ['test@example.com'] });

    const removeBtn = screen.getByLabelText('Remove test@example.com');
    await user.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders valid email chip with remove button', () => {
    renderField({ value: ['valid@example.com'] });

    const chip = screen.getByText('valid@example.com');
    expect(chip).toBeInTheDocument();

    // Each chip has an accessible remove button
    expect(screen.getByLabelText('Remove valid@example.com')).toBeInTheDocument();
  });

  it('hides placeholder when there are chips', () => {
    renderField({ value: ['a@example.com'] });
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', '');
  });

  it('disables input when disabled prop is true', () => {
    renderField({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

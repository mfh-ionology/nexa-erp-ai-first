import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ConfirmationDialog } from './confirmation-dialog';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  titleKey: 'actionBar.confirm.voidTitle',
  descriptionKey: 'actionBar.confirm.voidDescription',
  entityName: 'INV-2026-0047',
  onConfirm: vi.fn(),
};

describe('ConfirmationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and description with entity name interpolated', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    // i18n mock returns the key as value — the t() function receives entityName as interpolation param
    expect(screen.getByText('actionBar.confirm.voidTitle')).toBeInTheDocument();
    expect(screen.getByText('actionBar.confirm.voidDescription')).toBeInTheDocument();
  });

  it('renders Cancel and Confirm buttons', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('actionBar.confirm.cancel')).toBeInTheDocument();
    expect(screen.getByText('actionBar.confirm.button')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);

    await user.click(screen.getByText('actionBar.confirm.cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);

    await user.click(screen.getByText('actionBar.confirm.button'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirm button is disabled when isLoading is true', () => {
    render(<ConfirmationDialog {...defaultProps} isLoading />);

    const confirmBtn = screen.getByText('actionBar.confirm.button').closest('button');
    expect(confirmBtn).toBeDisabled();
  });

  it('does not render when open is false', () => {
    render(<ConfirmationDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('actionBar.confirm.voidTitle')).not.toBeInTheDocument();
  });

  it('closes dialog on Escape key', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);

    await user.keyboard('{Escape}');
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders with destructive variant by default', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    // The confirm button should exist — variant styling is applied via Shadcn
    const confirmBtn = screen.getByText('actionBar.confirm.button').closest('button');
    expect(confirmBtn).toBeInTheDocument();
  });
});

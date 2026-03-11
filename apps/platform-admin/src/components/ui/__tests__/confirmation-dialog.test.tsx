// ---------------------------------------------------------------------------
// Tests — ConfirmationDialog component
// Story: E13b.2 Task 7.6
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ConfirmationDialog } from '../confirmation-dialog';

describe('ConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and description when open', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<ConfirmationDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('renders custom confirm and cancel labels', () => {
    render(<ConfirmationDialog {...defaultProps} confirmLabel="Delete It" cancelLabel="Keep It" />);

    expect(screen.getByText('Delete It')).toBeInTheDocument();
    expect(screen.getByText('Keep It')).toBeInTheDocument();
  });

  it('renders default labels when not specified', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  describe('requireReason mode (BR-PLT-001)', () => {
    it('shows reason textarea when requireReason is true', () => {
      render(<ConfirmationDialog {...defaultProps} requireReason />);

      expect(screen.getByPlaceholderText('Enter reason...')).toBeInTheDocument();
      expect(screen.getByText(/Reason/)).toBeInTheDocument();
    });

    it('does not show reason textarea when requireReason is false', () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.queryByPlaceholderText('Enter reason...')).not.toBeInTheDocument();
    });

    it('disables confirm button when reason is empty', () => {
      render(<ConfirmationDialog {...defaultProps} requireReason confirmLabel="Suspend Tenant" />);

      const confirmBtn = screen.getByRole('button', { name: 'Suspend Tenant' });
      expect(confirmBtn).toBeDisabled();
    });

    it('enables confirm button when reason is entered', async () => {
      const user = userEvent.setup();
      render(<ConfirmationDialog {...defaultProps} requireReason confirmLabel="Suspend Tenant" />);

      await user.type(screen.getByPlaceholderText('Enter reason...'), 'Policy violation');

      const confirmBtn = screen.getByRole('button', { name: 'Suspend Tenant' });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('calls onConfirm with the reason text when confirmed', async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      render(
        <ConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          requireReason
          confirmLabel="Suspend Tenant"
        />,
      );

      await user.type(screen.getByPlaceholderText('Enter reason...'), 'Policy violation');
      await user.click(screen.getByRole('button', { name: 'Suspend Tenant' }));

      expect(onConfirm).toHaveBeenCalledWith('Policy violation');
    });
  });

  it('shows "Processing..." when loading', () => {
    render(<ConfirmationDialog {...defaultProps} loading />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('disables confirm button when loading', () => {
    render(<ConfirmationDialog {...defaultProps} loading />);

    const confirmBtn = screen.getByText('Processing...');
    expect(confirmBtn).toBeDisabled();
  });

  it('disables cancel button when loading', () => {
    render(<ConfirmationDialog {...defaultProps} loading />);

    const cancelBtn = screen.getByText('Cancel');
    expect(cancelBtn).toBeDisabled();
  });
});

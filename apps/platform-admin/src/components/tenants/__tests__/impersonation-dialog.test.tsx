// ---------------------------------------------------------------------------
// Component Tests — ImpersonationDialog
// Story: E13b.5 Task 4.3
// ---------------------------------------------------------------------------

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ImpersonationDialog } from '../impersonation-dialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApiPost = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock window.open
const mockWindowOpen = vi.fn();
vi.stubGlobal('open', mockWindowOpen);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderDialog(props: Partial<React.ComponentProps<typeof ImpersonationDialog>> = {}) {
  const qc = createQueryClient();
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    tenantId: 'tenant-1',
    tenantName: 'Acme Corp',
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={qc}>
        <ImpersonationDialog {...defaultProps} />
      </QueryClientProvider>,
    ),
    props: defaultProps,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImpersonationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reason field and duration selector when open', () => {
    renderDialog();

    expect(screen.getByTestId('impersonation-reason')).toBeInTheDocument();
    expect(screen.getByTestId('impersonation-duration')).toBeInTheDocument();
    expect(screen.getByText('Impersonate Tenant')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByText('Impersonate Tenant')).not.toBeInTheDocument();
  });

  it('renders warning text about auditing', () => {
    renderDialog();

    expect(screen.getByText(/All actions will be audited/)).toBeInTheDocument();
  });

  it('renders all duration options', () => {
    renderDialog();

    const select = screen.getByTestId('impersonation-duration');
    expect(select).toBeInTheDocument();

    // Check all 6 duration options exist
    expect(screen.getByText('15 minutes')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    expect(screen.getByText('1 hour')).toBeInTheDocument();
    expect(screen.getByText('2 hours')).toBeInTheDocument();
    expect(screen.getByText('4 hours')).toBeInTheDocument();
    expect(screen.getByText('8 hours')).toBeInTheDocument();
  });

  it('defaults duration to 60 minutes (1 hour)', () => {
    renderDialog();

    const select = screen.getByTestId('impersonation-duration') as HTMLSelectElement;
    expect(select.value).toBe('60');
  });

  describe('submit button state', () => {
    it('submit button disabled when reason is empty', () => {
      renderDialog();

      const submitBtn = screen.getByTestId('impersonation-submit');
      expect(submitBtn).toBeDisabled();
    });

    it('submit button disabled when reason is under 10 characters', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByTestId('impersonation-reason'), 'Short');

      const submitBtn = screen.getByTestId('impersonation-submit');
      expect(submitBtn).toBeDisabled();
    });

    it('shows validation message when reason is under 10 characters', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByTestId('impersonation-reason'), 'Short');

      expect(screen.getByText('Reason must be at least 10 characters')).toBeInTheDocument();
    });

    it('submit button enabled when reason has 10+ characters', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(
        screen.getByTestId('impersonation-reason'),
        'Investigating billing issue for customer',
      );

      const submitBtn = screen.getByTestId('impersonation-submit');
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe('API submission', () => {
    it('calls API on submit with correct payload', async () => {
      mockApiPost.mockResolvedValue({
        data: {
          sessionId: 'session-1',
          token: 'jwt-token-123',
          expiresAt: '2026-03-11T13:00:00Z',
        },
      });
      const user = userEvent.setup();
      renderDialog();

      await user.type(
        screen.getByTestId('impersonation-reason'),
        'Investigating billing issue for customer',
      );
      await user.click(screen.getByTestId('impersonation-submit'));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/admin/tenants/tenant-1/impersonate', {
          reason: 'Investigating billing issue for customer',
          durationMinutes: 60,
        });
      });
    });

    it('calls API with custom duration when changed', async () => {
      mockApiPost.mockResolvedValue({
        data: {
          sessionId: 'session-1',
          token: 'jwt-token-123',
          expiresAt: '2026-03-11T13:00:00Z',
        },
      });
      const user = userEvent.setup();
      renderDialog();

      await user.type(
        screen.getByTestId('impersonation-reason'),
        'Investigating billing issue for customer',
      );
      await user.selectOptions(screen.getByTestId('impersonation-duration'), '120');
      await user.click(screen.getByTestId('impersonation-submit'));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/admin/tenants/tenant-1/impersonate', {
          reason: 'Investigating billing issue for customer',
          durationMinutes: 120,
        });
      });
    });

    it('opens ERP URL in new tab on success', async () => {
      mockApiPost.mockResolvedValue({
        data: {
          sessionId: 'session-1',
          token: 'jwt-token-123',
          expiresAt: '2026-03-11T13:00:00Z',
        },
      });
      const user = userEvent.setup();
      renderDialog();

      await user.type(
        screen.getByTestId('impersonation-reason'),
        'Investigating billing issue for customer',
      );
      await user.click(screen.getByTestId('impersonation-submit'));

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith(
          expect.stringContaining('impersonation_token=jwt-token-123'),
          '_blank',
        );
      });
    });

    it('closes dialog on success', async () => {
      mockApiPost.mockResolvedValue({
        data: {
          sessionId: 'session-1',
          token: 'jwt-token-123',
          expiresAt: '2026-03-11T13:00:00Z',
        },
      });
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onOpenChange });

      await user.type(
        screen.getByTestId('impersonation-reason'),
        'Investigating billing issue for customer',
      );
      await user.click(screen.getByTestId('impersonation-submit'));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('shows error toast on API failure', async () => {
      mockApiPost.mockRejectedValue(new Error('Tenant is not active'));
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderDialog();

      await user.type(
        screen.getByTestId('impersonation-reason'),
        'Investigating billing issue for customer',
      );
      await user.click(screen.getByTestId('impersonation-submit'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Tenant is not active');
      });
    });
  });

  describe('RBAC integration (via parent)', () => {
    // Note: RBAC is enforced by the parent (TenantActionBar), not by this
    // dialog directly. The dialog is only rendered when the Impersonate button
    // is clicked, which is already gated by canPerformAction('impersonate').
    // This test verifies the dialog renders correctly when opened.
    it('renders fully when opened by an admin user', () => {
      renderDialog();

      expect(screen.getByText('Impersonate Tenant')).toBeInTheDocument();
      expect(screen.getByTestId('impersonation-reason')).toBeInTheDocument();
      expect(screen.getByTestId('impersonation-duration')).toBeInTheDocument();
      expect(screen.getByTestId('impersonation-submit')).toBeInTheDocument();
    });
  });
});

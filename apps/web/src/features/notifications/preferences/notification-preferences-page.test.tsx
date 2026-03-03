/* eslint-disable i18next/no-literal-string */

/**
 * Integration tests for <NotificationPreferencesPage>.
 *
 * Covers Task 6.1 + 6.3 (admin role-defaults visibility) + 6.4 (e2e toggle flow):
 * - Renders preference matrix with all templates
 * - Toggles update local state correctly
 * - Save button calls mutation with changed preferences only
 * - Reset button shows confirmation and resets on confirm
 * - Default indicators shown for templates without user preferences
 * - New templates appear automatically (AC #5)
 * - Admin can see role-defaults section
 * - Non-admin cannot see role-defaults section
 * - E2E: toggle off EMAIL → save → mutation receives correct payload
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { NotificationPreferenceItem } from '../api/use-notification-preferences';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn(),
  Link: ({ children, ...props }: Record<string, unknown>) => children,
}));

vi.mock('@/components/templates/page-header', () => ({
  PageHeader: ({ title, actionBarSlot }: { title: string; actionBarSlot?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {actionBarSlot && <div data-testid="action-bar">{actionBarSlot}</div>}
    </div>
  ),
}));

// Mock auth store
let mockPermissions: { role: string; isSuperAdmin?: boolean } | null = { role: 'STAFF' };
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ permissions: mockPermissions, isAuthenticated: true }),
}));

// Mock notification preference hooks
const mockUpdateMutate = vi.fn();
const mockResetMutate = vi.fn();
const mockRefetch = vi.fn();

let mockPreferencesData: { items: NotificationPreferenceItem[] } | undefined;
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../api/use-notification-preferences', () => ({
  useNotificationPreferences: () => ({
    data: mockPreferencesData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refetch: mockRefetch,
  }),
}));

vi.mock('../api/use-update-notification-preferences', () => ({
  useUpdateNotificationPreferences: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
}));

vi.mock('../api/use-reset-notification-preferences', () => ({
  useResetNotificationPreferences: () => ({
    mutate: mockResetMutate,
    isPending: false,
  }),
}));

// Mock role defaults hooks (used by RoleDefaultsSection)
const mockRoleDefaultsMutate = vi.fn();
vi.mock('../api/use-role-defaults', () => ({
  useRoleDefaults: () => ({
    data: { role: 'STAFF', items: [] },
    isLoading: false,
  }),
  useUpdateRoleDefaults: () => ({
    mutate: mockRoleDefaultsMutate,
    isPending: false,
  }),
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const basePreferences: NotificationPreferenceItem[] = [
  {
    templateId: 'tmpl-1',
    templateCode: 'INVOICE_APPROVED',
    templateName: 'Invoice Approved',
    eventName: 'invoice.approved',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'NORMAL',
    enableInApp: true,
    enableEmail: true,
    enablePush: false,
    priorityOverride: null,
    isMuted: false,
    muteUntil: null,
    hasUserPreference: false,
    source: 'TEMPLATE_DEFAULT',
  },
  {
    templateId: 'tmpl-2',
    templateCode: 'TASK_ASSIGNED',
    templateName: 'Task Assigned',
    eventName: 'task.assigned',
    defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
    defaultPriority: 'HIGH',
    enableInApp: true,
    enableEmail: true,
    enablePush: true,
    priorityOverride: null,
    isMuted: false,
    muteUntil: null,
    hasUserPreference: true,
    source: 'USER',
  },
  {
    templateId: 'tmpl-3',
    templateCode: 'ORDER_PLACED',
    templateName: 'Order Placed',
    eventName: 'order.placed',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    enableInApp: true,
    enableEmail: false,
    enablePush: false,
    priorityOverride: null,
    isMuted: false,
    muteUntil: null,
    hasUserPreference: false,
    source: 'TEMPLATE_DEFAULT',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderPage() {
  const { NotificationPreferencesPage } = await import('./notification-preferences-page');
  return render(<NotificationPreferencesPage />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationPreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferencesData = { items: basePreferences };
    mockIsLoading = false;
    mockIsError = false;
    mockPermissions = { role: 'STAFF' };
  });

  // --- 6.1: Renders preference matrix with all templates ---

  it('renders page title and description', async () => {
    await renderPage();

    expect(screen.getByText('preferences.title')).toBeInTheDocument();
    expect(screen.getByText('preferences.description')).toBeInTheDocument();
  });

  it('renders all template names in the matrix', async () => {
    await renderPage();

    expect(screen.getByText('Invoice Approved')).toBeInTheDocument();
    expect(screen.getByText('Task Assigned')).toBeInTheDocument();
    expect(screen.getByText('Order Placed')).toBeInTheDocument();
  });

  it('renders switch toggles for each template-channel combination', async () => {
    await renderPage();

    // 3 templates × 3 channels = 9 switches
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(9);
  });

  // --- 6.1: Toggles update local state correctly ---

  it('enables save button after toggling a switch', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Save button should be disabled initially
    const saveButton = screen.getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();

    // Toggle a switch
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]!);

    // Save button should now be enabled
    expect(saveButton).toBeEnabled();
  });

  // --- 6.1: Save button calls mutation with changed preferences only ---

  it('save button sends only dirty preferences', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Toggle the first switch (Invoice Approved - In-App: true → false)
    const invoiceInAppSwitch = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.inApp/i,
    });
    await user.click(invoiceInAppSwitch);

    // Click save
    const saveButton = screen.getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    await user.click(saveButton);

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    const payload = mockUpdateMutate.mock.calls[0]![0];

    // Should only include the changed template (tmpl-1)
    expect(payload.preferences).toHaveLength(1);
    expect(payload.preferences[0]).toEqual({
      notificationTemplateId: 'tmpl-1',
      enableInApp: false, // toggled from true
      enableEmail: true,
      enablePush: false,
    });
  });

  // --- 6.1: Reset button shows confirmation and resets on confirm ---

  it('reset button shows confirmation dialog and resets on confirm', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Click the reset button to open dialog
    const resetTrigger = screen.getByRole('button', {
      name: /preferences\.resetButton/i,
    });
    await user.click(resetTrigger);

    // Confirmation dialog should appear
    expect(screen.getByText('preferences.resetConfirm')).toBeInTheDocument();

    // Click the confirm action inside the dialog
    const confirmButtons = screen.getAllByRole('button', {
      name: /preferences\.resetButton/i,
    });
    // The confirm button inside the dialog (not the trigger)
    const confirmButton = confirmButtons.find(
      (btn) => btn.closest('[role="alertdialog"]') !== null,
    );
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton!);

    expect(mockResetMutate).toHaveBeenCalledTimes(1);
    expect(mockResetMutate).toHaveBeenCalledWith(undefined);
  });

  // --- 6.1: Default indicators shown for templates without user preferences ---

  it('shows default indicators for templates using template defaults', async () => {
    await renderPage();

    // Templates with hasUserPreference=false should show "(default)" labels
    const defaultLabels = screen.getAllByText('preferences.usingDefault');
    // tmpl-1 and tmpl-3 have hasUserPreference=false
    // Each has channels matching defaults that should show (default)
    expect(defaultLabels.length).toBeGreaterThan(0);
  });

  // --- 6.1: New templates appear automatically (AC #5) ---

  it('renders newly added templates when data changes', async () => {
    const { rerender } = await (async () => {
      const { NotificationPreferencesPage } = await import('./notification-preferences-page');
      return render(<NotificationPreferencesPage />);
    })();

    expect(screen.getByText('Invoice Approved')).toBeInTheDocument();
    expect(screen.queryByText('Payment Received')).not.toBeInTheDocument();

    // Simulate a new template being added (server returns updated data)
    const newTemplate: NotificationPreferenceItem = {
      templateId: 'tmpl-4',
      templateCode: 'PAYMENT_RECEIVED',
      templateName: 'Payment Received',
      eventName: 'payment.received',
      defaultChannels: ['IN_APP', 'EMAIL'],
      defaultPriority: 'NORMAL',
      enableInApp: true,
      enableEmail: true,
      enablePush: false,
      priorityOverride: null,
      isMuted: false,
      muteUntil: null,
      hasUserPreference: false,
      source: 'TEMPLATE_DEFAULT',
    };
    mockPreferencesData = { items: [...basePreferences, newTemplate] };

    const { NotificationPreferencesPage } = await import('./notification-preferences-page');
    rerender(<NotificationPreferencesPage />);

    expect(screen.getByText('Payment Received')).toBeInTheDocument();
  });

  // --- 6.1: Error state ---

  it('renders error state with retry button', async () => {
    mockIsError = true;
    await renderPage();

    expect(screen.getByText('preferences.loadError')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(retryButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // --- 6.1: Unsaved changes indicator ---

  it('shows unsaved changes warning when state is dirty', async () => {
    const user = userEvent.setup();
    await renderPage();

    // No warning initially
    expect(screen.queryByText('preferences.unsavedChanges')).not.toBeInTheDocument();

    // Toggle a switch to create dirty state
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]!);

    // Warning should appear
    expect(screen.getByText('preferences.unsavedChanges')).toBeInTheDocument();
  });

  // --- 6.3: Admin can see role-defaults section ---

  it('renders role-defaults section when user is ADMIN', async () => {
    mockPermissions = { role: 'ADMIN' };
    await renderPage();

    expect(screen.getByText('preferences.roleDefaults.title')).toBeInTheDocument();
  });

  it('renders role-defaults section when user is SUPER_ADMIN', async () => {
    mockPermissions = { role: 'SUPER_ADMIN' };
    await renderPage();

    expect(screen.getByText('preferences.roleDefaults.title')).toBeInTheDocument();
  });

  it('renders role-defaults section when user has isSuperAdmin flag', async () => {
    mockPermissions = { role: 'STAFF', isSuperAdmin: true };
    await renderPage();

    expect(screen.getByText('preferences.roleDefaults.title')).toBeInTheDocument();
  });

  // --- 6.3: Non-admin cannot see role-defaults section ---

  it('does NOT render role-defaults section for STAFF user', async () => {
    mockPermissions = { role: 'STAFF' };
    await renderPage();

    expect(screen.queryByText('preferences.roleDefaults.title')).not.toBeInTheDocument();
  });

  it('does NOT render role-defaults section for MANAGER user', async () => {
    mockPermissions = { role: 'MANAGER' };
    await renderPage();

    expect(screen.queryByText('preferences.roleDefaults.title')).not.toBeInTheDocument();
  });

  // --- 6.4: E2E toggle flow — toggle off EMAIL → save → verify payload ---

  it('e2e: toggle off EMAIL for Invoice Approved, save, verify mutation payload', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Find the Invoice Approved EMAIL switch
    const emailSwitch = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.email/i,
    });
    expect(emailSwitch).toHaveAttribute('data-state', 'checked');

    // Toggle it off
    await user.click(emailSwitch);
    expect(emailSwitch).toHaveAttribute('data-state', 'unchecked');

    // Save
    const saveButton = screen.getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    await user.click(saveButton);

    // Verify mutation was called with the correct payload
    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    const payload = mockUpdateMutate.mock.calls[0]![0];
    expect(payload.preferences).toEqual([
      {
        notificationTemplateId: 'tmpl-1',
        enableInApp: true,
        enableEmail: false, // toggled off
        enablePush: false,
      },
    ]);
  });

  it('e2e: multiple toggles across templates, save sends all changes', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Toggle Invoice Approved EMAIL off
    const invoiceEmail = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.email/i,
    });
    await user.click(invoiceEmail);

    // Toggle Order Placed Push on
    const orderPush = screen.getByRole('switch', {
      name: /Order Placed preferences\.channel\.push/i,
    });
    await user.click(orderPush);

    // Save
    const saveButton = screen.getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    await user.click(saveButton);

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    const payload = mockUpdateMutate.mock.calls[0]![0];

    // Should include both changed templates
    expect(payload.preferences).toHaveLength(2);

    const tmpl1 = payload.preferences.find(
      (p: Record<string, unknown>) => p.notificationTemplateId === 'tmpl-1',
    );
    const tmpl3 = payload.preferences.find(
      (p: Record<string, unknown>) => p.notificationTemplateId === 'tmpl-3',
    );

    expect(tmpl1).toEqual({
      notificationTemplateId: 'tmpl-1',
      enableInApp: true,
      enableEmail: false,
      enablePush: false,
    });
    expect(tmpl3).toEqual({
      notificationTemplateId: 'tmpl-3',
      enableInApp: true,
      enableEmail: false,
      enablePush: true, // toggled on
    });
  });

  it('save button remains disabled when no changes exist', async () => {
    await renderPage();

    const saveButton = screen.getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();
  });

  it('does not call mutation when save is clicked with no changes', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Toggle a switch on then off to return to original state
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]!);
    await user.click(switches[0]!);

    // Save should be disabled since we're back to original state
    const saveButton = screen.getByRole('button', {
      name: /preferences\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();
  });
});

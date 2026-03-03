/* eslint-disable i18next/no-literal-string */

/**
 * Component tests for <PreferenceMatrix>.
 *
 * Covers Task 6.2:
 * - Renders all templates as rows with channel toggles
 * - Category grouping works correctly
 * - Visual distinction between user-set and default preferences
 * - Loading skeleton
 * - Empty state
 * - Toggle callback fires correctly
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { NotificationPreferenceItem } from '../api/use-notification-preferences';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const testPreferences: NotificationPreferenceItem[] = [
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
    templateCode: 'INVOICE_OVERDUE',
    templateName: 'Invoice Overdue',
    eventName: 'invoice.overdue',
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
  {
    templateId: 'tmpl-4',
    templateCode: 'TASK_ASSIGNED',
    templateName: 'Task Assigned',
    eventName: 'task.assigned',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'NORMAL',
    enableInApp: true,
    enableEmail: true,
    enablePush: false,
    priorityOverride: null,
    isMuted: false,
    muteUntil: null,
    hasUserPreference: true,
    source: 'USER',
  },
];

type Channel = 'enableInApp' | 'enableEmail' | 'enablePush';

function buildLocalState(prefs: NotificationPreferenceItem[]) {
  const state: Record<string, Record<Channel, boolean>> = {};
  for (const p of prefs) {
    state[p.templateId] = {
      enableInApp: p.enableInApp,
      enableEmail: p.enableEmail,
      enablePush: p.enablePush,
    };
  }
  return state;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderMatrix(
  overrides?: Partial<{
    preferences: NotificationPreferenceItem[];
    localState: Record<string, Record<Channel, boolean>>;
    onToggle: (templateId: string, channel: Channel) => void;
    isLoading: boolean;
  }>,
) {
  const { PreferenceMatrix } = await import('./preference-matrix');
  const prefs = overrides?.preferences ?? testPreferences;
  return render(
    <PreferenceMatrix
      preferences={prefs}
      localState={overrides?.localState ?? buildLocalState(prefs)}
      onToggle={overrides?.onToggle ?? vi.fn()}
      isLoading={overrides?.isLoading ?? false}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PreferenceMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Renders all templates as rows with channel toggles ---

  it('renders all template names', async () => {
    await renderMatrix();

    expect(screen.getByText('Invoice Approved')).toBeInTheDocument();
    expect(screen.getByText('Invoice Overdue')).toBeInTheDocument();
    expect(screen.getByText('Order Placed')).toBeInTheDocument();
    expect(screen.getByText('Task Assigned')).toBeInTheDocument();
  });

  it('renders 3 switches per template (12 total)', async () => {
    await renderMatrix();

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(12); // 4 templates × 3 channels
  });

  it('renders channel column headers in each category group', async () => {
    await renderMatrix();

    // 3 categories (Invoice, Order, Task) × 3 channel headers each
    expect(screen.getAllByText('preferences.channel.inApp')).toHaveLength(3);
    expect(screen.getAllByText('preferences.channel.email')).toHaveLength(3);
    expect(screen.getAllByText('preferences.channel.push')).toHaveLength(3);
  });

  // --- Category grouping works correctly ---

  it('groups templates by event name prefix', async () => {
    await renderMatrix();

    // invoice.approved + invoice.overdue → "Invoice" category
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    // order.placed → "Order" category
    expect(screen.getByText('Order')).toBeInTheDocument();
    // task.assigned → "Task" category
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('places both invoice templates in the same category group', async () => {
    await renderMatrix();

    // The Invoice category heading should have both templates visible
    const invoiceHeading = screen.getByText('Invoice');
    const categorySection = invoiceHeading.closest('[class*="rounded-lg"]');
    expect(categorySection).not.toBeNull();

    // Both invoice template names should be within the same section
    expect(categorySection!.textContent).toContain('Invoice Approved');
    expect(categorySection!.textContent).toContain('Invoice Overdue');
  });

  // --- Visual distinction between user-set and default preferences ---

  it('shows (default) label for templates without user preference', async () => {
    await renderMatrix();

    // Templates with hasUserPreference=false should show "(default)"
    const defaultLabels = screen.getAllByText('preferences.usingDefault');
    expect(defaultLabels.length).toBeGreaterThan(0);
  });

  it('does NOT show (default) label for templates with user preference', async () => {
    // Render with only user-set preferences
    const userOnlyPrefs = testPreferences.filter((p) => p.hasUserPreference);
    await renderMatrix({ preferences: userOnlyPrefs });

    expect(screen.queryByText('preferences.usingDefault')).not.toBeInTheDocument();
  });

  // --- Switch states reflect the local state ---

  it('renders switches with correct checked state', async () => {
    await renderMatrix();

    // Invoice Approved: inApp=true, email=true, push=false
    const invoiceInApp = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.inApp/i,
    });
    expect(invoiceInApp).toHaveAttribute('data-state', 'checked');

    const invoiceEmail = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.email/i,
    });
    expect(invoiceEmail).toHaveAttribute('data-state', 'checked');

    const invoicePush = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.push/i,
    });
    expect(invoicePush).toHaveAttribute('data-state', 'unchecked');
  });

  // --- Toggle callback ---

  it('calls onToggle with correct templateId and channel when switch is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    await renderMatrix({ onToggle });

    const invoicePush = screen.getByRole('switch', {
      name: /Invoice Approved preferences\.channel\.push/i,
    });
    await user.click(invoicePush);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('tmpl-1', 'enablePush');
  });

  it('calls onToggle for each switch clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    await renderMatrix({ onToggle });

    const orderInApp = screen.getByRole('switch', {
      name: /Order Placed preferences\.channel\.inApp/i,
    });
    await user.click(orderInApp);

    const taskEmail = screen.getByRole('switch', {
      name: /Task Assigned preferences\.channel\.email/i,
    });
    await user.click(taskEmail);

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenNthCalledWith(1, 'tmpl-3', 'enableInApp');
    expect(onToggle).toHaveBeenNthCalledWith(2, 'tmpl-4', 'enableEmail');
  });

  // --- Loading skeleton ---

  it('renders loading skeleton when isLoading is true', async () => {
    await renderMatrix({ isLoading: true, preferences: [] });

    // Should not render any template names
    expect(screen.queryByText('Invoice Approved')).not.toBeInTheDocument();
    // Should not render any switches
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  // --- Empty state ---

  it('renders empty state when no preferences exist', async () => {
    await renderMatrix({ preferences: [] });

    expect(screen.getByText('preferences.noTemplates')).toBeInTheDocument();
  });

  // --- Aria labels ---

  it('switch aria-labels include template name and channel', async () => {
    await renderMatrix();

    // Verify aria-label format: "{templateName} {channelLabel}"
    expect(
      screen.getByRole('switch', {
        name: /Invoice Approved preferences\.channel\.inApp/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', {
        name: /Task Assigned preferences\.channel\.push/i,
      }),
    ).toBeInTheDocument();
  });
});

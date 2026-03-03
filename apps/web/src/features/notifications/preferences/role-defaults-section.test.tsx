import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// --- Mock i18n ---
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// --- Mock role defaults hooks ---
const mockMutate = vi.fn();
const mockUseRoleDefaults = vi.fn();
const mockUseUpdateRoleDefaults = vi.fn();
vi.mock('../api/use-role-defaults', () => ({
  useRoleDefaults: (...args: unknown[]) => mockUseRoleDefaults(...args),
  useUpdateRoleDefaults: () => mockUseUpdateRoleDefaults(),
}));

// --- Test data ---
const testItems = [
  {
    templateId: 'tmpl-1',
    templateCode: 'INVOICE_APPROVED',
    templateName: 'Invoice Approved',
    eventName: 'invoice.approved',
    defaultChannels: ['IN_APP', 'EMAIL'] as const,
    enableInApp: true,
    enableEmail: true,
    enablePush: false,
    hasRoleDefault: true,
  },
  {
    templateId: 'tmpl-2',
    templateCode: 'ORDER_PLACED',
    templateName: 'Order Placed',
    eventName: 'order.placed',
    defaultChannels: ['IN_APP'] as const,
    enableInApp: true,
    enableEmail: false,
    enablePush: false,
    hasRoleDefault: false,
  },
];

// --- Helper ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function setupDefaultMocks(
  overrides: Partial<{
    items: typeof testItems;
    isLoading: boolean;
    isPending: boolean;
  }> = {},
) {
  mockUseRoleDefaults.mockReturnValue({
    data: { role: 'STAFF', items: overrides.items ?? testItems },
    isLoading: overrides.isLoading ?? false,
  });
  mockUseUpdateRoleDefaults.mockReturnValue({
    mutate: mockMutate,
    isPending: overrides.isPending ?? false,
  });
}

async function renderSection() {
  const { RoleDefaultsSection } = await import('./role-defaults-section');
  return render(createElement(RoleDefaultsSection), {
    wrapper: createWrapper(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RoleDefaultsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders section heading and role selector', async () => {
    await renderSection();

    expect(screen.getByText('preferences.roleDefaults.title')).toBeInTheDocument();
    expect(screen.getByText('preferences.roleDefaults.description')).toBeInTheDocument();
    // Role selector is present with STAFF as default
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders template names as rows', async () => {
    await renderSection();

    expect(screen.getByText('Invoice Approved')).toBeInTheDocument();
    expect(screen.getByText('Order Placed')).toBeInTheDocument();
  });

  it('renders channel column headers in each category', async () => {
    await renderSection();

    // Each category group renders its own column headers (2 categories × 3 channels)
    expect(screen.getAllByText('preferences.channel.inApp')).toHaveLength(2);
    expect(screen.getAllByText('preferences.channel.email')).toHaveLength(2);
    expect(screen.getAllByText('preferences.channel.push')).toHaveLength(2);
  });

  it('renders toggle switches for each template-channel combination', async () => {
    await renderSection();

    // Each template has 3 channel switches = 6 total
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(6);
  });

  it('groups templates by category', async () => {
    await renderSection();

    // invoice.approved → "Invoice" category
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    // order.placed → "Order" category
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('save button is disabled when no changes made', async () => {
    await renderSection();

    const saveButton = screen.getByRole('button', {
      name: /preferences\.roleDefaults\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();
  });

  it('shows loading skeleton when data is loading', async () => {
    setupDefaultMocks({ isLoading: true, items: [] });
    await renderSection();

    expect(screen.queryByText('Invoice Approved')).not.toBeInTheDocument();
  });

  it('shows empty state when no templates exist', async () => {
    setupDefaultMocks({ items: [] });
    await renderSection();

    expect(screen.getByText('preferences.noTemplates')).toBeInTheDocument();
  });

  it('enables save button after toggling a switch', async () => {
    const user = userEvent.setup();
    await renderSection();

    // Find the first switch and toggle it
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]!);

    const saveButton = screen.getByRole('button', {
      name: /preferences\.roleDefaults\.saveButton/i,
    });
    expect(saveButton).toBeEnabled();
  });

  it('calls updateRoleDefaults with dirty preferences on save', async () => {
    const user = userEvent.setup();
    await renderSection();

    // Toggle first switch (Invoice Approved - In-App: true → false)
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]!);

    // Click save
    const saveButton = screen.getByRole('button', {
      name: /preferences\.roleDefaults\.saveButton/i,
    });
    await user.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith({
      role: 'STAFF',
      preferences: [
        {
          notificationTemplateId: 'tmpl-1',
          enableInApp: false, // toggled from true
          enableEmail: true,
          enablePush: false,
        },
      ],
    });
  });

  it('fetches role defaults with selected role', async () => {
    await renderSection();

    expect(mockUseRoleDefaults).toHaveBeenCalledWith('STAFF');
  });

  it('disables save button when mutation is pending', async () => {
    setupDefaultMocks({ isPending: true });
    await renderSection();

    const saveButton = screen.getByRole('button', {
      name: /preferences\.roleDefaults\.saveButton/i,
    });
    expect(saveButton).toBeDisabled();
  });
});

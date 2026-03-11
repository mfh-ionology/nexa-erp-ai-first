// ---------------------------------------------------------------------------
// Component Tests — Providers Tab
// Story E13b-4 Task 7.5 (AC#6, AC#7)
// ---------------------------------------------------------------------------

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockUser: { id: string; email: string; displayName: string; role: string } | null = {
  id: 'admin-1',
  email: 'admin@nexa.io',
  displayName: 'Admin User',
  role: 'PLATFORM_ADMIN',
};

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isAuthenticated: true, user: mockUser }),
  ),
}));

// Mock provider hooks
const mockProviders = vi.fn();
const mockUpdateKeyMutate = vi.fn();
const mockToggleMutate = vi.fn();
let mockUpdateKeyPending = false;
let mockUpdateKeyError: Error | null = null;
let mockTogglePending = false;

vi.mock('../hooks/use-ai-providers', () => ({
  useAiProviders: () => mockProviders(),
  useUpdateProviderKey: () => ({
    mutate: mockUpdateKeyMutate,
    isPending: mockUpdateKeyPending,
    isError: mockUpdateKeyError !== null,
    error: mockUpdateKeyError,
    reset: vi.fn(),
  }),
  useToggleProvider: () => ({
    mutate: mockToggleMutate,
    isPending: mockTogglePending,
  }),
}));

import { ProvidersTab } from '../components/providers-tab';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_PROVIDERS = [
  {
    providerId: 'anthropic',
    displayName: 'Anthropic',
    isActive: true,
    hasApiKey: true,
    lastUsedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    providerId: 'openai',
    displayName: 'OpenAI',
    isActive: false,
    hasApiKey: true,
    lastUsedAt: null,
  },
  {
    providerId: 'google',
    displayName: 'Google AI',
    isActive: true,
    hasApiKey: false,
    lastUsedAt: null,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUser(role: string) {
  mockUser = {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@nexa.io`,
    displayName: `${role} User`,
    role,
  };
}

function renderProvidersTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProvidersTab />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProvidersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('PLATFORM_ADMIN');
    mockUpdateKeyPending = false;
    mockUpdateKeyError = null;
    mockTogglePending = false;
    mockProviders.mockReturnValue({
      data: MOCK_PROVIDERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders provider list with correct number of items', () => {
    renderProvidersTab();

    const list = screen.getByRole('list', { name: /ai providers/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('renders provider names', () => {
    renderProvidersTab();

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Google AI')).toBeInTheDocument();
  });

  it('renders active/inactive status badges', () => {
    renderProvidersTab();

    const anthropicStatus = screen.getByTestId('provider-status-anthropic');
    expect(anthropicStatus).toHaveTextContent('Active');

    const openaiStatus = screen.getByTestId('provider-status-openai');
    expect(openaiStatus).toHaveTextContent('Inactive');
  });

  // -------------------------------------------------------------------------
  // Key masking
  // -------------------------------------------------------------------------

  it('shows masked API key indicator for providers with keys', () => {
    renderProvidersTab();

    const anthropicKey = screen.getByTestId('provider-key-anthropic');
    expect(anthropicKey).toHaveTextContent('API Key: ****');
  });

  it('shows "No API key configured" for providers without keys', () => {
    renderProvidersTab();

    const googleKey = screen.getByTestId('provider-key-google');
    expect(googleKey).toHaveTextContent('No API key configured');
  });

  // -------------------------------------------------------------------------
  // Update Key Modal
  // -------------------------------------------------------------------------

  it('opens update key modal when Update Key button is clicked', async () => {
    const user = userEvent.setup();
    renderProvidersTab();

    const updateBtn = screen.getByTestId('update-key-btn-anthropic');
    await user.click(updateBtn);

    expect(screen.getByText('Update API Key — Anthropic')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
  });

  it('disables confirm button when API key input is empty', async () => {
    const user = userEvent.setup();
    renderProvidersTab();

    await user.click(screen.getByTestId('update-key-btn-anthropic'));

    const updateKeyBtn = screen.getByRole('button', { name: 'Update Key' });
    expect(updateKeyBtn).toBeDisabled();
  });

  it('enables confirm button when API key is entered', async () => {
    const user = userEvent.setup();
    renderProvidersTab();

    await user.click(screen.getByTestId('update-key-btn-anthropic'));
    await user.type(screen.getByLabelText('API Key'), 'sk-test-key-123');

    const updateKeyBtn = screen.getByRole('button', { name: 'Update Key' });
    expect(updateKeyBtn).not.toBeDisabled();
  });

  it('calls update key mutation when form is submitted', async () => {
    const user = userEvent.setup();
    renderProvidersTab();

    await user.click(screen.getByTestId('update-key-btn-anthropic'));
    await user.type(screen.getByLabelText('API Key'), 'sk-test-key-123');
    await user.click(screen.getByRole('button', { name: 'Update Key' }));

    expect(mockUpdateKeyMutate).toHaveBeenCalledWith(
      { providerId: 'anthropic', apiKey: 'sk-test-key-123' },
      expect.any(Object),
    );
  });

  // -------------------------------------------------------------------------
  // Toggle provider
  // -------------------------------------------------------------------------

  it('renders toggle switch for each provider for PLATFORM_ADMIN', () => {
    renderProvidersTab();

    expect(screen.getByTestId('provider-toggle-anthropic')).toBeInTheDocument();
    expect(screen.getByTestId('provider-toggle-openai')).toBeInTheDocument();
    expect(screen.getByTestId('provider-toggle-google')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // RBAC
  // -------------------------------------------------------------------------

  it('shows Update Key and toggle for PLATFORM_ADMIN', () => {
    setUser('PLATFORM_ADMIN');
    renderProvidersTab();

    expect(screen.getAllByRole('button', { name: /update key/i })).toHaveLength(3);
    expect(screen.getByTestId('provider-toggle-anthropic')).toBeInTheDocument();
  });

  it('hides Update Key and toggle for PLATFORM_VIEWER', () => {
    setUser('PLATFORM_VIEWER');
    renderProvidersTab();

    expect(screen.queryByRole('button', { name: /update key/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('provider-toggle-anthropic')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when no providers exist', () => {
    mockProviders.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderProvidersTab();

    expect(screen.getByText('No providers configured')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading & Error states
  // -------------------------------------------------------------------------

  it('shows loading state', () => {
    mockProviders.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderProvidersTab();

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('No providers configured')).not.toBeInTheDocument();
  });

  it('shows error state with retry button', async () => {
    const mockRefetch = vi.fn();
    mockProviders.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    });
    renderProvidersTab();

    expect(screen.getByText('Failed to load providers')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry');
    await userEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });
});

/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean; user: { id: string; role: string } }) => unknown) =>
      selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

const mockApiGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
  },
}));

import { IndustryBreakdownSection } from '../components/industry-breakdown-section';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderSection() {
  // The component uses both usePatterns and useCorrections (multiple infinite queries)
  // Return empty data for all — this gets us past the loading state
  mockApiGet.mockResolvedValue({
    data: [],
    meta: { hasMore: false },
  });

  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(<IndustryBreakdownSection />, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndustryBreakdownSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header and industry selector', async () => {
    renderSection();

    // Wait for loading to complete — look for the industry selector label
    expect(await screen.findByLabelText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Industry Breakdown')).toBeInTheDocument();
  });

  it('shows "All Industries" as default selected option', async () => {
    renderSection();

    const selector = (await screen.findByLabelText('Industry')) as HTMLSelectElement;
    // Default value is '' which shows 'All Industries' text
    expect(selector.value).toBe('');
  });

  it('filters data when industry selector changes', async () => {
    const user = userEvent.setup();
    renderSection();

    const selector = await screen.findByLabelText('Industry');
    await user.selectOptions(selector, 'Construction');

    // After selecting Construction, the API should be called with industry filter
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('industry=Construction'));
  });

  it('has proper section aria label', async () => {
    renderSection();

    await screen.findByText('Industry Breakdown');

    const section = screen.getByRole('region', { name: /industry breakdown/i });
    expect(section).toBeInTheDocument();
  });
});

/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type { PlatformInsight } from '@/types/intelligence';

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
const mockApiPatch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: vi.fn(),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
  },
}));

import { FeatureGapsSection } from '../components/feature-gaps-section';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function createInsight(overrides: Partial<PlatformInsight> = {}): PlatformInsight {
  return {
    id: `insight-${Math.random().toString(36).slice(2)}`,
    insightType: 'FEATURE_GAP',
    title: 'Missing feature',
    description: 'AI cannot handle this',
    evidence: { module: 'AR', tenantCount: 8, frequency: 120 },
    severity: 'HIGH',
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

const testInsights = [
  createInsight({
    id: 'ig-1',
    title: 'Missing AR dunning',
    severity: 'HIGH',
    evidence: { module: 'AR', tenantCount: 12, frequency: 200 },
  }),
  createInsight({
    id: 'ig-2',
    title: 'No inventory forecast',
    severity: 'MEDIUM',
    evidence: { module: 'Inventory', tenantCount: 7, frequency: 90 },
  }),
  createInsight({
    id: 'ig-3',
    title: 'No sales commission calc',
    severity: 'LOW',
    evidence: { module: 'Sales', tenantCount: 3, frequency: 30 },
  }),
];

// Generate 12 insights to test View All expansion
const manyInsights = Array.from({ length: 12 }, (_, i) =>
  createInsight({
    id: `ig-many-${i}`,
    title: `Feature gap ${i + 1}`,
    severity: i < 4 ? 'HIGH' : i < 8 ? 'MEDIUM' : 'LOW',
    evidence: { module: 'AR', tenantCount: 10 - i, frequency: 100 - i * 5 },
  }),
);

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

function renderSection(insights: PlatformInsight[] = testInsights) {
  mockApiGet.mockResolvedValueOnce({
    data: insights,
    meta: { hasMore: false },
  });

  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(<FeatureGapsSection />, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeatureGapsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header and subtitle', async () => {
    renderSection();

    expect(await screen.findByText('Feature Gaps')).toBeInTheDocument();
    expect(screen.getByText(/unbuilt features/i)).toBeInTheDocument();
  });

  it('shows severity badges with text labels (not colour-only)', async () => {
    renderSection();

    await screen.findByText('Missing AR dunning');

    // Severity badges should include text "High", "Medium", "Low"
    expect(screen.getByLabelText('Severity: High')).toBeInTheDocument();
    expect(screen.getByLabelText('Severity: Medium')).toBeInTheDocument();
    expect(screen.getByLabelText('Severity: Low')).toBeInTheDocument();
  });

  it('shows View All button when more than 10 insights', async () => {
    renderSection(manyInsights);

    await screen.findByText('Feature gap 1');

    // Should show "View All" button since 12 > 10
    const viewAllButton = screen.getByText(/view all/i);
    expect(viewAllButton).toBeInTheDocument();

    // Initially shows only 10 items
    expect(screen.queryByText('Feature gap 11')).not.toBeInTheDocument();
  });

  it('expands to show all insights when View All is clicked', async () => {
    const user = userEvent.setup();
    renderSection(manyInsights);

    await screen.findByText('Feature gap 1');

    const viewAllButton = screen.getByText(/view all/i);
    await user.click(viewAllButton);

    // Now all 12 should be visible
    expect(screen.getByText('Feature gap 11')).toBeInTheDocument();
    expect(screen.getByText('Feature gap 12')).toBeInTheDocument();
  });

  it('shows module badges on each insight row', async () => {
    renderSection();

    await screen.findByText('Missing AR dunning');

    // Module badges appear in rows (may also appear in chart); verify at least one exists
    expect(screen.getAllByText('AR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inventory').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sales').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no feature gaps exist', async () => {
    renderSection([]);

    expect(await screen.findByText(/no feature gaps detected/i)).toBeInTheDocument();
  });

  it('shows error state with retry button on failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Server error'));

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    render(<FeatureGapsSection />, { wrapper });

    expect(await screen.findByText('Failed to load feature gaps')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('has proper list semantics', async () => {
    renderSection();

    await screen.findByText('Missing AR dunning');

    const list = screen.getByRole('list', { name: /feature gap insights/i });
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});

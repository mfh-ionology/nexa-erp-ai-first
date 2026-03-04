/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type {
  IntelligenceSummary,
  PlatformInsight,
  SkillEffectiveness,
  TenantPattern,
  TenantCorrection,
} from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean; user: { id: string; role: string } }) => unknown) =>
      selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
  buildQueryString: (params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
  },
}));

import { IntelligencePage } from '../intelligence-page';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockSummary: IntelligenceSummary = {
  totalContributingTenants: 12,
  totalPatterns: 850,
  totalCorrections: 234,
  totalKnowledgeArticles: 42,
  overallAiSuccessRate: 87.5,
  lastAggregatedAt: '2026-03-04T10:00:00.000Z',
  topSkillsByUsage: [],
  topInsightsBySeverity: [],
};

const mockFeatureGaps: PlatformInsight[] = [
  {
    id: 'fg-1',
    insightType: 'FEATURE_GAP',
    title: 'Missing AR dunning',
    description: 'No skill for dunning',
    evidence: { module: 'AR', tenantCount: 12, frequency: 200 },
    severity: 'HIGH',
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

const mockWorkflowOpps: PlatformInsight[] = [
  {
    id: 'wo-1',
    insightType: 'WORKFLOW_OPPORTUNITY',
    title: 'Export aging then email',
    description: '40% of tenants do this manually',
    evidence: { tenantCount: 8, frequency: 50 },
    severity: 'MEDIUM',
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

const mockDefaultCandidates: PlatformInsight[] = [];

const mockSkillEffectiveness: SkillEffectiveness[] = [
  {
    id: 'se-1',
    skillKey: 'ar.aging_report',
    measureDate: '2026-03-01',
    tenantCount: 10,
    totalQueries: 500,
    avgSuccessRate: '0.92',
    avgCorrectionRate: '0.08',
    avgConfidence: '0.85',
    trend: 'IMPROVING',
    createdAt: '2026-03-01T00:00:00Z',
  },
];

const mockPatterns: TenantPattern[] = [];
const mockCorrections: TenantCorrection[] = [];

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

function setupMockApi() {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/admin/intelligence/summary')) {
      return Promise.resolve({ data: mockSummary });
    }
    if (url.includes('/admin/intelligence/insights') && url.includes('FEATURE_GAP')) {
      return Promise.resolve({ data: mockFeatureGaps, meta: { hasMore: false } });
    }
    if (url.includes('/admin/intelligence/insights') && url.includes('WORKFLOW_OPPORTUNITY')) {
      return Promise.resolve({ data: mockWorkflowOpps, meta: { hasMore: false } });
    }
    if (url.includes('/admin/intelligence/insights') && url.includes('DEFAULT_CANDIDATE')) {
      return Promise.resolve({ data: mockDefaultCandidates, meta: { hasMore: false } });
    }
    if (url.includes('/admin/intelligence/insights')) {
      return Promise.resolve({ data: [], meta: { hasMore: false } });
    }
    if (url.includes('/admin/intelligence/skill-effectiveness')) {
      return Promise.resolve({ data: mockSkillEffectiveness, meta: { hasMore: false } });
    }
    if (url.includes('/admin/intelligence/patterns')) {
      return Promise.resolve({ data: mockPatterns, meta: { hasMore: false } });
    }
    if (url.includes('/admin/intelligence/corrections')) {
      return Promise.resolve({ data: mockCorrections, meta: { hasMore: false } });
    }
    return Promise.resolve({ data: [], meta: { hasMore: false } });
  });
}

function renderPage() {
  setupMockApi();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(<IntelligencePage />, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntelligencePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and breadcrumb', async () => {
    renderPage();

    expect(await screen.findByText('AI Intelligence')).toBeInTheDocument();
    expect(screen.getByText(/platform admin/i)).toBeInTheDocument();
  });

  it('renders all major sections with mocked API data', async () => {
    renderPage();

    // Wait for data to load — use findByText on actual data that comes from API
    expect(await screen.findByText('Missing AR dunning')).toBeInTheDocument();

    // Section headings are rendered in both CollapsibleSection buttons and section headers
    // Just verify key sections exist via getAllByText (mobile toggle + desktop header)
    expect(screen.getAllByText('Feature Gaps').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Workflow Opportunities').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Default Optimisation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Skill Effectiveness').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Industry Breakdown').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Correction Patterns').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeletons during data fetch', () => {
    // Never-resolving API to keep loading state
    mockApiGet.mockReturnValue(new Promise(() => {}));

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { container } = render(<IntelligencePage />, { wrapper });

    // Skeleton elements should be present
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders "Publish Knowledge" floating action button', async () => {
    renderPage();

    // Wait for page to finish loading sections
    expect(await screen.findByText('Missing AR dunning')).toBeInTheDocument();

    const fab = screen.getByLabelText('Publish Knowledge');
    expect(fab).toBeInTheDocument();
  });

  it('opens publish panel when FAB is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Missing AR dunning')).toBeInTheDocument();

    const fab = screen.getByLabelText('Publish Knowledge');
    await user.click(fab);

    // Panel should open
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('Publish Knowledge flow: open panel, fill form, save as draft', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ data: { id: 'new-1', status: 'DRAFT' } });
    renderPage();

    expect(await screen.findByText('Missing AR dunning')).toBeInTheDocument();

    // Click the FAB
    const fab = screen.getByLabelText('Publish Knowledge');
    await user.click(fab);

    // Panel should be open with empty form
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');

    // Fill the form
    await user.type(titleInput, 'Test Article');
    await user.type(screen.getByLabelText(/content/i), 'Some content');

    // Click "Save as Draft"
    await user.click(screen.getByText('Save as Draft'));

    // Create mutation should be called
    expect(mockApiPost).toHaveBeenCalled();
  });

  it('shows feature gap insights from mocked data', async () => {
    renderPage();

    expect(await screen.findByText('Missing AR dunning')).toBeInTheDocument();
  });

  it('renders Run Aggregation button (admin-only)', async () => {
    renderPage();

    expect(await screen.findByText('Run Aggregation')).toBeInTheDocument();
  });

  it('shows confirmation dialog when Run Aggregation is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const runBtn = await screen.findByText('Run Aggregation');
    await user.click(runBtn);

    // Confirmation dialog says "This will collect and aggregate..."
    expect(screen.getByText(/this will collect and aggregate/i)).toBeInTheDocument();
  });
});

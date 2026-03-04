/* eslint-disable i18next/no-literal-string */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type { SkillEffectiveness } from '@/types/intelligence';

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

import { SkillEffectivenessTable } from '../components/skill-effectiveness-table';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testSkills: SkillEffectiveness[] = [
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
  {
    id: 'se-2',
    skillKey: 'finance.vat_return',
    measureDate: '2026-03-01',
    tenantCount: 8,
    totalQueries: 300,
    avgSuccessRate: '0.65',
    avgCorrectionRate: '0.35',
    avgConfidence: '0.70',
    trend: 'STABLE',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'se-3',
    skillKey: 'sales.pipeline_analysis',
    measureDate: '2026-03-01',
    tenantCount: 5,
    totalQueries: 100,
    avgSuccessRate: '0.40',
    avgCorrectionRate: '0.45',
    avgConfidence: '0.55',
    trend: 'DECLINING',
    createdAt: '2026-03-01T00:00:00Z',
  },
];

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

function renderTable(props: { onFilterBySkill?: (key: string) => void } = {}) {
  mockApiGet.mockResolvedValueOnce({
    data: testSkills,
    meta: { hasMore: false },
  });

  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(<SkillEffectivenessTable {...props} />, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillEffectivenessTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table with skill data', async () => {
    renderTable();

    // Wait for data to load
    expect(await screen.findByText('ar.aging_report')).toBeInTheDocument();
    expect(screen.getByText('finance.vat_return')).toBeInTheDocument();
    expect(screen.getByText('sales.pipeline_analysis')).toBeInTheDocument();
  });

  it('sorts by column on header click', async () => {
    const user = userEvent.setup();
    renderTable();

    // Wait for data
    await screen.findByText('ar.aging_report');

    // Click "Tenant Count" header to sort ascending (default is descending on avgSuccessRate)
    const tenantCountHeader = screen.getByRole('button', { name: /sort by tenant count/i });
    await user.click(tenantCountHeader);

    // After sort ascending by tenant count: 5, 8, 10
    const rows = screen.getAllByRole('row').slice(1); // skip header row
    const firstRowTenantCount = within(rows[0]!).getByText('5');
    expect(firstRowTenantCount).toBeInTheDocument();
  });

  it('applies colour coding based on success rate thresholds', async () => {
    renderTable();

    await screen.findByText('ar.aging_report');

    // High success rate (>80%): 92.0% should have green class
    const highRate = screen.getByLabelText(/success rate: 92\.0%, high/i);
    expect(highRate).toBeInTheDocument();
    expect(highRate.className).toContain('bg-green');

    // Medium success rate (50-80%): 65.0%
    const medRate = screen.getByLabelText(/success rate: 65\.0%, medium/i);
    expect(medRate).toBeInTheDocument();
    expect(medRate.className).toContain('bg-amber');

    // Low success rate (<50%): 40.0%
    const lowRate = screen.getByLabelText(/success rate: 40\.0%, low/i);
    expect(lowRate).toBeInTheDocument();
    expect(lowRate.className).toContain('bg-red');
  });

  it('shows warning icon for correction rate >30%', async () => {
    renderTable();

    await screen.findByText('ar.aging_report');

    // finance.vat_return has 35% correction rate — should show warning
    const warnings = screen.getAllByLabelText(/high correction rate warning/i);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('shows trend indicators with text labels', async () => {
    renderTable();

    await screen.findByText('ar.aging_report');

    expect(screen.getByLabelText('Trend: Improving')).toBeInTheDocument();
    expect(screen.getByLabelText('Trend: Stable')).toBeInTheDocument();
    expect(screen.getByLabelText('Trend: Declining')).toBeInTheDocument();
  });

  it('filters by module when module filter changes', async () => {
    const user = userEvent.setup();
    renderTable();

    await screen.findByText('ar.aging_report');

    // Select "AR" module
    const moduleSelect = screen.getByLabelText(/filter by module/i);
    await user.selectOptions(moduleSelect, 'AR');

    // Only AR skill should remain
    expect(screen.getByText('ar.aging_report')).toBeInTheDocument();
    expect(screen.queryByText('finance.vat_return')).not.toBeInTheDocument();
    expect(screen.queryByText('sales.pipeline_analysis')).not.toBeInTheDocument();
  });

  it('calls onFilterBySkill when skill name is clicked', async () => {
    const onFilterBySkill = vi.fn();
    const user = userEvent.setup();
    renderTable({ onFilterBySkill });

    await screen.findByText('ar.aging_report');

    // The skill name renders as a button with the skill key as text content
    const skillButton = screen.getByRole('button', { name: 'ar.aging_report' });
    await user.click(skillButton);

    expect(onFilterBySkill).toHaveBeenCalledWith('ar.aging_report');
  });

  it('shows loading skeleton during data fetch', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { container } = render(<SkillEffectivenessTable />, { wrapper });

    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('shows error state with retry button on failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network failure'));

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    render(<SkillEffectivenessTable />, { wrapper });

    expect(await screen.findByText('Failed to load skill effectiveness data')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});

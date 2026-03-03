/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAutomationRunDetail, AiAutomationStepRun } from '../api/types';

// --- Mock TanStack Router ---
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  ),
}));

// --- Mock sonner toast ---
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Mock run hooks ---
const mockUseAutomationRun = vi.fn();
const mockRetryMutate = vi.fn();

vi.mock('../api/use-ai-automation-runs', () => ({
  useAutomationRun: (...args: unknown[]) => mockUseAutomationRun(...args),
  useRetryAutomationRun: () => ({ mutate: mockRetryMutate, isPending: false }),
}));

// --- Mock StepTimeline to simplify detail page tests ---
vi.mock('./components/step-timeline', () => ({
  StepTimeline: ({ stepRuns, onRetryStep }: { stepRuns: unknown[]; onRetryStep?: () => void }) => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'step-timeline' },
      React.createElement('span', null, `${stepRuns.length} steps`),
      onRetryStep &&
        React.createElement(
          'button',
          { onClick: onRetryStep, type: 'button' },
          'Retry from This Step',
        ),
    );
  },
}));

// --- Test data ---
const testStepRuns: AiAutomationStepRun[] = [
  {
    id: 'step-1',
    stepId: 's1',
    stepOrder: 1,
    agentId: 'agent-1',
    agentName: 'InvoiceAnalyser',
    agentDisplayName: 'Invoice Analyser',
    goal: 'Analyse overdue invoices',
    modelId: 'claude-opus',
    status: 'COMPLETED',
    input: { query: 'overdue invoices' },
    output: { count: 5 },
    error: null,
    inputTokens: 3000,
    outputTokens: 2000,
    latencyMs: 4500,
    turns: 2,
    startedAt: '2026-03-03T07:00:05Z',
    completedAt: '2026-03-03T07:00:09Z',
  },
  {
    id: 'step-2',
    stepId: 's2',
    stepOrder: 2,
    agentId: 'agent-2',
    agentName: 'Notifier',
    agentDisplayName: 'Notification Agent',
    goal: 'Send alerts',
    modelId: 'claude-sonnet',
    status: 'COMPLETED',
    input: { alerts: ['user1'] },
    output: { sent: 1 },
    error: null,
    inputTokens: 1500,
    outputTokens: 500,
    latencyMs: 2000,
    turns: 1,
    startedAt: '2026-03-03T07:00:10Z',
    completedAt: '2026-03-03T07:00:12Z',
  },
];

const testRun: AiAutomationRunDetail = {
  id: 'run-123-full-uuid',
  automationId: 'auto-1',
  automationName: 'Daily AR Analysis',
  triggerType: 'SCHEDULED',
  triggeredBy: 'scheduler',
  status: 'COMPLETED',
  startedAt: '2026-03-03T07:00:00Z',
  completedAt: '2026-03-03T07:00:45Z',
  totalTokens: 7000,
  totalCost: '0.0175',
  error: null,
  createdAt: '2026-03-03T07:00:00Z',
  result: { success: true },
  retryOfRunId: null,
  stepRuns: testStepRuns,
};

const failedStepRuns: AiAutomationStepRun[] = [
  {
    id: 'step-f1',
    stepId: 'sf1',
    stepOrder: 1,
    agentId: 'agent-1',
    agentName: 'InvoiceAnalyser',
    agentDisplayName: 'Invoice Analyser',
    goal: 'Analyse invoices',
    modelId: 'claude-opus',
    status: 'COMPLETED',
    input: {},
    output: { result: true },
    error: null,
    inputTokens: 2000,
    outputTokens: 1000,
    latencyMs: 3000,
    turns: 1,
    startedAt: '2026-03-03T07:00:05Z',
    completedAt: '2026-03-03T07:00:08Z',
  },
  {
    id: 'step-f2',
    stepId: 'sf2',
    stepOrder: 2,
    agentId: 'agent-2',
    agentName: 'Notifier',
    agentDisplayName: 'Notification Agent',
    goal: 'Send notifications',
    modelId: 'claude-sonnet',
    status: 'FAILED',
    input: { alerts: ['user1'] },
    output: null,
    error: 'Connection timeout after 30s',
    inputTokens: 500,
    outputTokens: 0,
    latencyMs: 30000,
    turns: 1,
    startedAt: '2026-03-03T07:00:09Z',
    completedAt: '2026-03-03T07:00:39Z',
  },
  {
    id: 'step-f3',
    stepId: 'sf3',
    stepOrder: 3,
    agentId: 'agent-3',
    agentName: 'Reporter',
    agentDisplayName: 'Report Agent',
    goal: 'Generate report',
    modelId: null,
    status: 'SKIPPED',
    input: null,
    output: null,
    error: null,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: null,
    turns: 0,
    startedAt: null,
    completedAt: null,
  },
];

const failedRun: AiAutomationRunDetail = {
  id: 'run-fail-uuid',
  automationId: 'auto-2',
  automationName: 'Stock Reorder Alert',
  triggerType: 'EVENT',
  triggeredBy: 'event:stock.reorder',
  status: 'FAILED',
  startedAt: '2026-03-03T07:00:00Z',
  completedAt: '2026-03-03T07:00:39Z',
  totalTokens: 3500,
  totalCost: '0.0088',
  error: 'Step 2 failed: Connection timeout after 30s',
  createdAt: '2026-03-03T07:00:00Z',
  result: null,
  retryOfRunId: null,
  stepRuns: failedStepRuns,
};

function setupMocks(
  overrides: {
    run?: AiAutomationRunDetail | undefined;
    isLoading?: boolean;
    isError?: boolean;
  } = {},
) {
  mockUseAutomationRun.mockReturnValue({
    data: overrides.run ?? testRun,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: vi.fn(),
  });
}

// Dynamic import after mocks
async function renderPage(props: { runId: string } = { runId: 'run-123-full-uuid' }) {
  const { AutomationRunDetailPage } = await import('./automation-run-detail-page');
  return render(<AutomationRunDetailPage {...props} />);
}

describe('AutomationRunDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders run ID in the page title', async () => {
      await renderPage();

      // Title appears in both breadcrumb and h1; use heading role
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent(/Run run-123/);
    });

    it('renders status label "Completed"', async () => {
      await renderPage();

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders triggered by as "Scheduler"', async () => {
      await renderPage();

      expect(screen.getByText('Scheduler')).toBeInTheDocument();
    });

    it('renders started at timestamp', async () => {
      await renderPage();

      // Timestamps appear in multiple places; verify at least one exists
      const timestamps = screen.getAllByText(/03 Mar 2026 07:00:00/);
      expect(timestamps.length).toBeGreaterThanOrEqual(1);
    });

    it('renders completed at timestamp', async () => {
      await renderPage();

      // Two timestamps with same date pattern
      const completedText = screen.getAllByText(/03 Mar 2026 07:00/);
      expect(completedText.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Metrics cards ---

  describe('metrics cards', () => {
    it('renders total tokens with input/output breakdown', async () => {
      await renderPage();

      expect(screen.getByText('7,000')).toBeInTheDocument();
      expect(screen.getByText(/In: 4,500/)).toBeInTheDocument();
      expect(screen.getByText(/Out: 2,500/)).toBeInTheDocument();
    });

    it('renders total cost as £X.XXXX', async () => {
      await renderPage();

      expect(screen.getByText('£0.0175')).toBeInTheDocument();
    });

    it('renders steps count as completed/total', async () => {
      await renderPage();

      // 2 completed steps out of 2 total
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('/2')).toBeInTheDocument();
    });

    it('renders duration for completed run', async () => {
      await renderPage();

      // 45 seconds duration
      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('renders turns count', async () => {
      await renderPage();

      // Total turns: 2 + 1 = 3
      expect(screen.getByText('3 turns total')).toBeInTheDocument();
    });
  });

  // --- Step timeline ---

  describe('step timeline', () => {
    it('renders step timeline component with correct step count', async () => {
      await renderPage();

      expect(screen.getByTestId('step-timeline')).toBeInTheDocument();
      expect(screen.getByText('2 steps')).toBeInTheDocument();
    });
  });

  // --- Error banner for failed run ---

  describe('failed run', () => {
    beforeEach(() => {
      setupMocks({ run: failedRun });
    });

    it('renders error banner with error message', async () => {
      await renderPage({ runId: 'run-fail-uuid' });

      expect(screen.getByText('Run Failed')).toBeInTheDocument();
      expect(screen.getByText('Step 2 failed: Connection timeout after 30s')).toBeInTheDocument();
    });

    it('renders "Retry from Failed Step" button in error banner', async () => {
      await renderPage({ runId: 'run-fail-uuid' });

      expect(screen.getByText('Retry from Failed Step')).toBeInTheDocument();
    });

    it('renders Retry button in the action bar for FAILED runs', async () => {
      await renderPage({ runId: 'run-fail-uuid' });

      // There should be a header-level Retry button
      const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
      expect(retryButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('"Retry from Failed Step" shows confirmation dialog', async () => {
      const user = userEvent.setup();
      await renderPage({ runId: 'run-fail-uuid' });

      // Multiple "Retry from Failed Step" buttons exist (error banner + mocked timeline)
      // Click the first one (error banner)
      const retryBtns = screen.getAllByText('Retry from Failed Step');
      await user.click(retryBtns[0]!);

      expect(
        screen.getByText(/This will create a new run starting from step 2/),
      ).toBeInTheDocument();
    });

    it('renders step timeline with failed steps', async () => {
      await renderPage({ runId: 'run-fail-uuid' });

      expect(screen.getByText('3 steps')).toBeInTheDocument();
    });
  });

  // --- Retry confirmation dialog ---

  describe('retry confirmation', () => {
    beforeEach(() => {
      setupMocks({ run: failedRun });
    });

    it('confirming retry fires mutation', async () => {
      const user = userEvent.setup();
      await renderPage({ runId: 'run-fail-uuid' });

      // Click the error banner retry button
      const retryBannerBtn = screen.getByText('Retry from Failed Step');
      await user.click(retryBannerBtn);

      // Find and click the dialog confirm button (the last "Retry" button in the dialog)
      const dialogContent = screen.getByRole('alertdialog');
      const confirmButton = dialogContent.querySelector('button:last-of-type');
      expect(confirmButton).toBeTruthy();
      await user.click(confirmButton!);

      expect(mockRetryMutate).toHaveBeenCalledWith(
        'run-fail-uuid',
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  // --- retryOfRunId ---

  describe('retry of run ID', () => {
    it('shows link to original run when retryOfRunId is present', async () => {
      setupMocks({
        run: { ...testRun, retryOfRunId: 'original-run-id-full-uuid' },
      });
      await renderPage();

      expect(screen.getByText('Retry of')).toBeInTheDocument();
      // Link renders first 8 chars + hellip entity: "original" + "…"
      const link = screen.getByText(/original/);
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        '/ai/admin/automations/runs/original-run-id-full-uuid',
      );
    });

    it('does not show retry of section when retryOfRunId is null', async () => {
      await renderPage();

      expect(screen.queryByText('Retry of')).not.toBeInTheDocument();
    });
  });

  // --- Run metadata footer ---

  describe('run metadata footer', () => {
    it('renders full run ID in mono font', async () => {
      await renderPage();

      const codeEl = screen.getByText('run-123-full-uuid');
      expect(codeEl.tagName).toBe('CODE');
    });

    it('renders copy run ID button', async () => {
      await renderPage();

      expect(screen.getByLabelText('Copy run ID')).toBeInTheDocument();
    });

    it('renders created at timestamp', async () => {
      await renderPage();

      // Created at: 03 Mar 2026
      const timestamps = screen.getAllByText(/03 Mar 2026/);
      expect(timestamps.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Loading state ---

  describe('loading state', () => {
    it('renders skeleton placeholders when loading', async () => {
      setupMocks({ isLoading: true, run: undefined });
      await renderPage();

      // Should not show run data
      expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    });
  });

  // --- Error state ---

  describe('error state', () => {
    it('renders error card when query fails', async () => {
      setupMocks({ isError: true, run: undefined });
      await renderPage();

      expect(screen.getByText('Failed to load run')).toBeInTheDocument();
      expect(screen.getByText('Back to Runs')).toBeInTheDocument();
    });

    it('"Back to Runs" button navigates to runs list', async () => {
      const user = userEvent.setup();
      setupMocks({ isError: true, run: undefined });
      await renderPage();

      const backBtn = screen.getByText('Back to Runs');
      await user.click(backBtn);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/automations/runs' }),
      );
    });
  });

  // --- Completed run has no retry button ---

  describe('completed run', () => {
    it('does not show Retry button for completed runs', async () => {
      await renderPage();

      // In action bar, there should be no Retry button (only View Automation)
      expect(screen.queryByText('Retry from Failed Step')).not.toBeInTheDocument();
    });
  });
});

/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAutomationStepRun } from '../../api/types';

// --- Mock sonner toast (used by json-viewer copy) ---
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Test data ---
const completedStep: AiAutomationStepRun = {
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
  output: { count: 5, items: ['inv-1', 'inv-2'] },
  error: null,
  inputTokens: 3000,
  outputTokens: 2000,
  latencyMs: 4500,
  turns: 2,
  startedAt: '2026-03-03T07:00:05Z',
  completedAt: '2026-03-03T07:00:09Z',
};

const failedStep: AiAutomationStepRun = {
  id: 'step-2',
  stepId: 's2',
  stepOrder: 2,
  agentId: 'agent-2',
  agentName: 'Notifier',
  agentDisplayName: 'Notification Agent',
  goal: 'Send alerts',
  modelId: 'claude-sonnet',
  status: 'FAILED',
  input: { alerts: ['user1'] },
  output: null,
  error: 'Connection timeout after 30s',
  inputTokens: 500,
  outputTokens: 0,
  latencyMs: 30000,
  turns: 1,
  startedAt: '2026-03-03T07:00:10Z',
  completedAt: '2026-03-03T07:00:40Z',
};

const skippedStep: AiAutomationStepRun = {
  id: 'step-3',
  stepId: 's3',
  stepOrder: 3,
  agentId: 'agent-3',
  agentName: 'Reporter',
  agentDisplayName: 'Report Agent',
  goal: 'Generate summary report',
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
};

const runningStep: AiAutomationStepRun = {
  id: 'step-r1',
  stepId: 'sr1',
  stepOrder: 1,
  agentId: 'agent-1',
  agentName: 'Processor',
  agentDisplayName: 'Data Processor',
  goal: 'Process data',
  modelId: 'claude-opus',
  status: 'RUNNING',
  input: { data: 'sample' },
  output: null,
  error: null,
  inputTokens: 100,
  outputTokens: 0,
  latencyMs: null,
  turns: 0,
  startedAt: '2026-03-03T10:00:00Z',
  completedAt: null,
};

const pendingStep: AiAutomationStepRun = {
  id: 'step-p1',
  stepId: 'sp1',
  stepOrder: 2,
  agentId: 'agent-4',
  agentName: 'Finaliser',
  agentDisplayName: 'Finaliser',
  goal: 'Finalise output',
  modelId: null,
  status: 'PENDING',
  input: null,
  output: null,
  error: null,
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: null,
  turns: 0,
  startedAt: null,
  completedAt: null,
};

// Dynamic import
async function renderTimeline(stepRuns: AiAutomationStepRun[], onRetryStep?: () => void) {
  const { StepTimeline } = await import('./step-timeline');
  return render(<StepTimeline stepRuns={stepRuns} onRetryStep={onRetryStep} />);
}

describe('StepTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders correct number of steps', async () => {
      await renderTimeline([completedStep, failedStep, skippedStep]);

      expect(screen.getByText(/Step 1:/)).toBeInTheDocument();
      expect(screen.getByText(/Step 2:/)).toBeInTheDocument();
      expect(screen.getByText(/Step 3:/)).toBeInTheDocument();
    });

    it('renders agent display names', async () => {
      await renderTimeline([completedStep, failedStep]);

      expect(screen.getByText(/Invoice Analyser/)).toBeInTheDocument();
      expect(screen.getByText(/Notification Agent/)).toBeInTheDocument();
    });

    it('renders status labels for each step', async () => {
      await renderTimeline([completedStep, failedStep, skippedStep]);

      // "Completed" may appear multiple times (header label + expanded section)
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Skipped').length).toBeGreaterThanOrEqual(1);
    });

    it('renders latency for steps that have it', async () => {
      await renderTimeline([completedStep]);

      expect(screen.getByText('4.5s')).toBeInTheDocument();
    });

    it('renders token count for steps with tokens', async () => {
      await renderTimeline([completedStep]);

      // 3000 + 2000 = 5000 tokens
      expect(screen.getByText('5,000 tokens')).toBeInTheDocument();
    });

    it('renders "Step Execution Timeline" heading', async () => {
      await renderTimeline([completedStep]);

      expect(screen.getByText('Step Execution Timeline')).toBeInTheDocument();
    });

    it('renders empty state when no steps', async () => {
      await renderTimeline([]);

      expect(screen.getByText('No steps recorded for this run.')).toBeInTheDocument();
    });
  });

  // --- Status indicators ---

  describe('status indicators', () => {
    it('renders Running status with label', async () => {
      await renderTimeline([runningStep, pendingStep]);

      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  // --- Expand/collapse ---

  describe('expand/collapse', () => {
    it('clicking a step header toggles expanded details', async () => {
      const user = userEvent.setup();
      await renderTimeline([completedStep]);

      // Initially collapsed — goal text not visible
      expect(screen.queryByText('Analyse overdue invoices')).not.toBeInTheDocument();

      // Click the step header to expand
      const stepButton = screen.getByText(/Step 1:/).closest('button');
      expect(stepButton).toBeTruthy();
      await user.click(stepButton!);

      // Now goal text should be visible
      expect(screen.getByText('Analyse overdue invoices')).toBeInTheDocument();
    });

    it('expanded step shows model and turns', async () => {
      const user = userEvent.setup();
      await renderTimeline([completedStep]);

      const stepButton = screen.getByText(/Step 1:/).closest('button');
      await user.click(stepButton!);

      expect(screen.getByText('claude-opus')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // turns
    });

    it('expanded step shows token breakdown', async () => {
      const user = userEvent.setup();
      await renderTimeline([completedStep]);

      const stepButton = screen.getByText(/Step 1:/).closest('button');
      await user.click(stepButton!);

      expect(screen.getByText(/In: 3,000/)).toBeInTheDocument();
      expect(screen.getByText(/Out: 2,000/)).toBeInTheDocument();
    });

    it('clicking expanded step collapses it', async () => {
      const user = userEvent.setup();
      await renderTimeline([completedStep]);

      const stepButton = screen.getByText(/Step 1:/).closest('button');
      await user.click(stepButton!);
      expect(screen.getByText('Analyse overdue invoices')).toBeInTheDocument();

      // Click again to collapse
      await user.click(stepButton!);
      expect(screen.queryByText('Analyse overdue invoices')).not.toBeInTheDocument();
    });
  });

  // --- Failed step ---

  describe('failed step', () => {
    it('auto-expands when it is the only failed step', async () => {
      await renderTimeline([completedStep, failedStep]);

      // The failed step should be auto-expanded, showing its error
      expect(screen.getByText('Connection timeout after 30s')).toBeInTheDocument();
    });

    it('shows error message in red alert', async () => {
      await renderTimeline([completedStep, failedStep]);

      // Error label
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Connection timeout after 30s')).toBeInTheDocument();
    });

    it('shows "Retry from This Step" button', async () => {
      const mockOnRetry = vi.fn();
      await renderTimeline([completedStep, failedStep], mockOnRetry);

      const retryBtn = screen.getByText('Retry from This Step');
      expect(retryBtn).toBeInTheDocument();
    });

    it('clicking "Retry from This Step" calls onRetryStep', async () => {
      const user = userEvent.setup();
      const mockOnRetry = vi.fn();
      await renderTimeline([completedStep, failedStep], mockOnRetry);

      const retryBtn = screen.getByText('Retry from This Step');
      await user.click(retryBtn);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  // --- SKIPPED step ---

  describe('skipped step', () => {
    it('shows italic "Skipped (previous step failed)" label when expanded', async () => {
      const user = userEvent.setup();
      await renderTimeline([completedStep, failedStep, skippedStep]);

      // Expand the skipped step
      const stepButton = screen.getByText(/Step 3:/).closest('button');
      await user.click(stepButton!);

      expect(screen.getByText('Skipped (previous step failed)')).toBeInTheDocument();
    });

    it('skipped step agent name has strikethrough styling', async () => {
      await renderTimeline([skippedStep]);

      const agentLabel = screen.getByText('Report Agent');
      expect(
        agentLabel.classList.contains('line-through') ||
          agentLabel.className.includes('line-through'),
      ).toBe(true);
    });
  });

  // --- JSON viewer in expanded step ---

  describe('json viewer', () => {
    it('renders Input and Output labels', async () => {
      const user = userEvent.setup();
      await renderTimeline([completedStep]);

      const stepButton = screen.getByText(/Step 1:/).closest('button');
      await user.click(stepButton!);

      expect(screen.getByText('Input')).toBeInTheDocument();
      expect(screen.getByText('Output')).toBeInTheDocument();
    });

    it('renders "No data" for null input/output', async () => {
      const user = userEvent.setup();
      await renderTimeline([skippedStep]);

      const stepButton = screen.getByText(/Step 3:/).closest('button');
      await user.click(stepButton!);

      const noDataElements = screen.getAllByText(/No data/);
      expect(noDataElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- Sorting ---

  describe('sorting', () => {
    it('sorts steps by stepOrder', async () => {
      // Pass steps out of order
      await renderTimeline([skippedStep, completedStep, failedStep]);

      const stepTexts = screen.getAllByText(/^Step \d+:/).map((el) => el.textContent);
      expect(stepTexts[0]).toContain('Step 1:');
      expect(stepTexts[1]).toContain('Step 2:');
      expect(stepTexts[2]).toContain('Step 3:');
    });
  });
});

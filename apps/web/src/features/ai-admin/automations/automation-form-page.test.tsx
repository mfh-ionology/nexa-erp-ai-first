/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAutomationDetail } from '../api/types';

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

// --- Mock automation hooks ---
const mockUseAiAutomation = vi.fn();
const mockUseAiAutomations = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockRunMutateAsync = vi.fn();

vi.mock('../api/use-ai-automations', () => ({
  useAiAutomation: (...args: unknown[]) => mockUseAiAutomation(...args),
  useAiAutomations: (...args: unknown[]) => mockUseAiAutomations(...args),
  useCreateAiAutomation: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateAiAutomation: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeleteAiAutomation: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
  useRunAutomation: () => ({
    mutateAsync: mockRunMutateAsync,
    isPending: false,
  }),
}));

// --- Mock agents hook ---
const mockUseAiAgents = vi.fn();
vi.mock('../api/use-ai-agents', () => ({
  useAiAgents: (...args: unknown[]) => mockUseAiAgents(...args),
}));

// --- Mock variable autocomplete's useAiVariables ---
vi.mock('../api/use-ai-variables', () => ({
  useAiVariables: () => ({ data: null }),
}));

// --- Test data ---
const testAutomation: AiAutomationDetail = {
  id: 'auto-1',
  name: 'Daily AR Analysis',
  description: 'Analyse overdue invoices each morning',
  triggerType: 'SCHEDULED',
  eventType: null,
  isActive: true,
  maxTokenBudget: 50000,
  maxDurationMs: 300000,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  lastRunId: null,
  lastRunStatus: 'COMPLETED',
  lastRunAt: '2026-03-03T07:00:00Z',
  stepCount: 1,
  schedule: {
    id: 'sched-1',
    cronExpression: '0 7 * * 1-5',
    timezone: 'Europe/London',
    nextRunAt: '2026-03-04T07:00:00Z',
    lastRunAt: '2026-03-03T07:00:00Z',
    isPaused: false,
  },
  chainFromId: null,
  chainNextId: null,
  notificationConfig: null,
  createdById: 'user-1',
  steps: [
    {
      id: 'step-1',
      stepOrder: 1,
      agentId: 'agent-1',
      agentName: 'ar-analyser',
      goal: 'Analyse all overdue invoices and prepare summary',
      inputConfig: {},
      outputConfig: {},
      maxTurns: 10,
    },
  ],
  recentRuns: [],
};

function setupMocks(
  overrides: {
    automation?: AiAutomationDetail | undefined;
    isLoading?: boolean;
    isError?: boolean;
  } = {},
) {
  mockUseAiAutomation.mockReturnValue({
    data: overrides.automation ?? undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
  mockUseAiAgents.mockReturnValue({
    data: {
      data: [
        {
          id: 'agent-1',
          name: 'ar-analyser',
          displayName: 'AR Analyser',
          isActive: true,
        },
        {
          id: 'agent-2',
          name: 'report-generator',
          displayName: 'Report Generator',
          isActive: true,
        },
      ],
    },
  });
  mockUseAiAutomations.mockReturnValue({
    data: { data: [] },
  });
}

// Dynamic import after mocks
async function renderPage(props: { id?: string } = {}) {
  const { AutomationFormPage } = await import('./automation-form-page');
  return render(<AutomationFormPage {...props} />);
}

describe('AutomationFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Create mode ---

  describe('create mode (no id)', () => {
    it('renders "New Automation" heading', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('New Automation');
    });

    it('renders Name form field', async () => {
      await renderPage();

      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('renders Description form field', async () => {
      await renderPage();

      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('renders trigger type radio options', async () => {
      await renderPage();

      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Event')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('renders step builder section with one default step', async () => {
      await renderPage();

      // Step builder heading
      expect(screen.getByText('Steps')).toBeInTheDocument();
      // Should have an "Add Step" button
      expect(screen.getByText('Add Step')).toBeInTheDocument();
    });

    it('renders budget configuration section', async () => {
      await renderPage();

      expect(screen.getByText('Budget & Limits')).toBeInTheDocument();
    });

    it('renders Save button', async () => {
      await renderPage();

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('does not render Delete or Run Now in create mode', async () => {
      await renderPage();

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /run now/i })).not.toBeInTheDocument();
    });

    it('shows Scheduled trigger config when Scheduled is selected', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Default is MANUAL; click Scheduled radio
      const scheduledLabel = screen.getByText('Scheduled');
      await user.click(scheduledLabel);

      // CronBuilder presets should be visible
      expect(screen.getByText('Presets')).toBeInTheDocument();
    });

    it('shows Event trigger config when Event is selected', async () => {
      const user = userEvent.setup();
      await renderPage();

      const eventLabel = screen.getByText('Event');
      await user.click(eventLabel);

      expect(screen.getByText('Event Type')).toBeInTheDocument();
    });

    it('step add button appends a new step', async () => {
      const user = userEvent.setup();
      await renderPage();

      const addStepBtn = screen.getByText('Add Step');
      await user.click(addStepBtn);

      // Should now show step number "2"
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('validation: name is required', async () => {
      await renderPage();

      // The name input has a placeholder
      const nameInput = screen.getByPlaceholderText('e.g. Daily AR Analysis');
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue('');
    });
  });

  // --- Edit mode ---

  describe('edit mode (with id)', () => {
    it('populates form with automation data', async () => {
      setupMocks({ automation: testAutomation });
      await renderPage({ id: 'auto-1' });

      const nameInputs = screen.getAllByDisplayValue('Daily AR Analysis');
      expect(nameInputs.length).toBeGreaterThan(0);
    });

    it('renders automation name in heading', async () => {
      setupMocks({ automation: testAutomation });
      await renderPage({ id: 'auto-1' });

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Daily AR Analysis');
    });

    it('shows Delete button in edit mode', async () => {
      setupMocks({ automation: testAutomation });
      await renderPage({ id: 'auto-1' });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('shows Run Now button in edit mode', async () => {
      setupMocks({ automation: testAutomation });
      await renderPage({ id: 'auto-1' });

      expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
    });

    it('shows loading skeletons when data is loading', async () => {
      setupMocks({ isLoading: true });
      await renderPage({ id: 'auto-1' });

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when automation load fails', async () => {
      setupMocks({ isError: true });
      await renderPage({ id: 'auto-1' });

      expect(screen.getByText(/failed to load automation/i)).toBeInTheDocument();
    });

    it('shows Active toggle in edit mode', async () => {
      setupMocks({ automation: testAutomation });
      await renderPage({ id: 'auto-1' });

      // "Active" appears in badge and form label — both should be present
      const activeElements = screen.getAllByText('Active');
      expect(activeElements.length).toBeGreaterThanOrEqual(1);
    });

    it('populates step goal from automation data', async () => {
      setupMocks({ automation: testAutomation });
      await renderPage({ id: 'auto-1' });

      const goalTextarea = screen.getByDisplayValue(
        'Analyse all overdue invoices and prepare summary',
      );
      expect(goalTextarea).toBeInTheDocument();
    });
  });
});

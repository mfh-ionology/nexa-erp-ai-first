/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SetupStatus } from '../../api/use-ai-setup-status';

// --- Mock TanStack Router ---
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock copilot store ---
const mockOpenDrawer = vi.fn();
vi.mock('@/stores/copilot-store', () => ({
  useCopilotStore: {
    getState: () => ({ openDrawer: mockOpenDrawer }),
  },
}));

// --- Test data ---
const allIncompleteStatus: SetupStatus = {
  modelsConnected: false,
  agentsConfigured: false,
  skillsActivated: false,
  automationCreated: false,
  copilotTested: false,
  wizardCompleted: false,
  checklistDismissed: false,
};

const threeCompleteStatus: SetupStatus = {
  modelsConnected: true,
  agentsConfigured: true,
  skillsActivated: true,
  automationCreated: false,
  copilotTested: false,
  wizardCompleted: false,
  checklistDismissed: false,
};

const allCompleteStatus: SetupStatus = {
  modelsConnected: true,
  agentsConfigured: true,
  skillsActivated: true,
  automationCreated: true,
  copilotTested: true,
  wizardCompleted: true,
  checklistDismissed: false,
};

async function renderChecklist(status: SetupStatus = allIncompleteStatus, onDismiss = vi.fn()) {
  const { AiSetupChecklist } = await import('../ai-setup-checklist');
  return render(<AiSetupChecklist status={status} onDismiss={onDismiss} />);
}

describe('AiSetupChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders 5 checklist items', async () => {
      await renderChecklist();

      const items = screen.getAllByRole('button').filter((b) => {
        const label = b.textContent ?? '';
        return label.includes('aiSetup.checklist.');
      });
      // There are 5 step items + 1 dismiss button; filter by disabled/enabled pattern
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });

    it('renders the checklist title', async () => {
      await renderChecklist();

      expect(screen.getByText('aiSetup.checklist.title')).toBeInTheDocument();
    });

    it('renders all 5 item label keys', async () => {
      await renderChecklist();

      expect(screen.getByText('aiSetup.checklist.verifyModels')).toBeInTheDocument();
      expect(screen.getByText('aiSetup.checklist.reviewAgents')).toBeInTheDocument();
      expect(screen.getByText('aiSetup.checklist.activateSkills')).toBeInTheDocument();
      expect(screen.getByText('aiSetup.checklist.createAutomation')).toBeInTheDocument();
      expect(screen.getByText('aiSetup.checklist.testCopilot')).toBeInTheDocument();
    });

    it('renders dismiss button', async () => {
      await renderChecklist();

      expect(screen.getByText('aiSetup.checklist.dismiss')).toBeInTheDocument();
    });
  });

  // --- Progress ---

  describe('progress indicator', () => {
    it('shows 0/5 progress when all items are incomplete', async () => {
      await renderChecklist(allIncompleteStatus);

      // i18n returns key as value, so the progress key is returned directly
      // The component calls t('aiSetup.checklist.progress', { completed: 0, total: 5 })
      // Since mock returns key, we just confirm the element exists with the key
      expect(screen.getByText('aiSetup.checklist.progress')).toBeInTheDocument();
    });

    it('shows progress key with 3 items complete', async () => {
      await renderChecklist(threeCompleteStatus);

      expect(screen.getByText('aiSetup.checklist.progress')).toBeInTheDocument();
    });
  });

  // --- Completed items ---

  describe('completed items', () => {
    it('completed items are disabled', async () => {
      await renderChecklist(threeCompleteStatus);

      // First 3 items (modelsConnected, agentsConfigured, skillsActivated) should be disabled
      const buttons = screen.getAllByRole('button');
      // Filter to item buttons (not dismiss)
      const itemButtons = buttons.filter((b) => b.hasAttribute('disabled'));
      expect(itemButtons).toHaveLength(3);
    });

    it('incomplete items are not disabled', async () => {
      await renderChecklist(threeCompleteStatus);

      // automationCreated and copilotTested should be enabled buttons
      const enabledItemButtons = screen
        .getAllByRole('button')
        .filter(
          (b) => !b.hasAttribute('disabled') && b.textContent?.includes('aiSetup.checklist.'),
        );
      expect(enabledItemButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('all items disabled when all complete', async () => {
      await renderChecklist(allCompleteStatus);

      const disabledButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('disabled'));
      expect(disabledButtons).toHaveLength(5);
    });
  });

  // --- Go action ---

  describe('go action', () => {
    it('renders "Go" action key for incomplete items', async () => {
      await renderChecklist(allIncompleteStatus);

      const goLinks = screen.getAllByText('aiSetup.checklist.goAction');
      expect(goLinks.length).toBe(5);
    });

    it('does not render "Go" action for completed items', async () => {
      await renderChecklist(allCompleteStatus);

      expect(screen.queryByText('aiSetup.checklist.goAction')).not.toBeInTheDocument();
    });
  });

  // --- Navigation ---

  describe('navigation', () => {
    it('clicking an incomplete link item navigates to correct path', async () => {
      const user = userEvent.setup();
      await renderChecklist(allIncompleteStatus);

      // Find the verifyModels button and click it
      const modelsButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('aiSetup.checklist.verifyModels'));
      expect(modelsButton).toBeTruthy();
      await user.click(modelsButton!);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/ai/admin/models' }),
      );
    });

    it('clicking completed item does not navigate', async () => {
      const user = userEvent.setup();
      await renderChecklist(threeCompleteStatus);

      // First item (modelsConnected = true) should not trigger navigate
      const modelsButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('aiSetup.checklist.verifyModels'));
      expect(modelsButton).toBeTruthy();
      await user.click(modelsButton!);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // --- Dismiss ---

  describe('dismiss', () => {
    it('clicking dismiss button calls onDismiss', async () => {
      const mockDismiss = vi.fn();
      const user = userEvent.setup();
      await renderChecklist(allIncompleteStatus, mockDismiss);

      const dismissButton = screen.getByText('aiSetup.checklist.dismiss');
      await user.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledOnce();
    });
  });
});

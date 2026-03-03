/* eslint-disable i18next/no-literal-string */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { TestTriggerResult } from '../api/types';

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

// --- Mock hooks ---
const mockTestTriggerMutateAsync = vi.fn();
const mockUseTestTrigger = vi.fn();

vi.mock('../api/use-ai-skills', () => ({
  useTestTrigger: (...args: unknown[]) => mockUseTestTrigger(...args),
}));

// --- Test data ---
const matchResult: TestTriggerResult = {
  matchedModule: 'ar',
  matchedSkill: {
    id: 'skill-1',
    name: 'ar-overdue-analysis',
    displayName: 'Overdue Invoice Analysis',
    confidence: 0.85,
  },
  l0Confidence: 0.9,
  l1Confidence: 0.85,
  requiredTools: ['query_entity', 'analyse_data'],
  skillContentPreview:
    '# Overdue Invoice Analysis\n\nAnalyse overdue invoices and recommend follow-up actions...',
  noMatch: false,
  suggestions: [],
};

const noMatchResult: TestTriggerResult = {
  matchedModule: null,
  matchedSkill: null,
  l0Confidence: 0.05,
  l1Confidence: 0,
  requiredTools: [],
  skillContentPreview: '',
  noMatch: true,
  suggestions: ['ar', 'finance', 'sales'],
};

function setupMocks(overrides: { isPending?: boolean } = {}) {
  mockUseTestTrigger.mockReturnValue({
    mutateAsync: mockTestTriggerMutateAsync,
    isPending: overrides.isPending ?? false,
  });
}

// Dynamic import after mocks
async function renderPanel(props: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  const { TestTriggerPanel } = await import('./test-trigger-panel');
  return render(
    <TestTriggerPanel open={props.open ?? true} onOpenChange={props.onOpenChange ?? vi.fn()} />,
  );
}

describe('TestTriggerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders panel title', async () => {
      await renderPanel();

      expect(screen.getByText('Test Trigger Phrase')).toBeInTheDocument();
    });

    it('renders input field with placeholder', async () => {
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      expect(input).toBeInTheDocument();
    });

    it('renders Test button', async () => {
      await renderPanel();

      expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument();
    });
  });

  // --- Match result ---

  describe('match result', () => {
    it('displays matched module with confidence', async () => {
      const user = userEvent.setup();
      mockTestTriggerMutateAsync.mockResolvedValue(matchResult);
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      await user.type(input, 'show me overdue invoices');

      const testButton = screen.getByRole('button', { name: /test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('ar')).toBeInTheDocument();
        expect(screen.getByText('90%')).toBeInTheDocument();
      });
    });

    it('displays matched skill name and confidence', async () => {
      const user = userEvent.setup();
      mockTestTriggerMutateAsync.mockResolvedValue(matchResult);
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      await user.type(input, 'show me overdue invoices');

      const testButton = screen.getByRole('button', { name: /test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('ar-overdue-analysis')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });

    it('displays required tools as badges', async () => {
      const user = userEvent.setup();
      mockTestTriggerMutateAsync.mockResolvedValue(matchResult);
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      await user.type(input, 'test');

      const testButton = screen.getByRole('button', { name: /test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('query_entity')).toBeInTheDocument();
        expect(screen.getByText('analyse_data')).toBeInTheDocument();
      });
    });
  });

  // --- No match ---

  describe('no match', () => {
    it('displays no match message', async () => {
      const user = userEvent.setup();
      mockTestTriggerMutateAsync.mockResolvedValue(noMatchResult);
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      await user.type(input, 'completely unrelated');

      const testButton = screen.getByRole('button', { name: /test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/no matching skill found/i)).toBeInTheDocument();
      });
    });

    it('displays available module suggestions', async () => {
      const user = userEvent.setup();
      mockTestTriggerMutateAsync.mockResolvedValue(noMatchResult);
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      await user.type(input, 'unrelated query');

      const testButton = screen.getByRole('button', { name: /test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('ar')).toBeInTheDocument();
        expect(screen.getByText('finance')).toBeInTheDocument();
        expect(screen.getByText('sales')).toBeInTheDocument();
      });
    });
  });

  // --- Keyboard support ---

  describe('keyboard support', () => {
    it('Enter key triggers test', async () => {
      const user = userEvent.setup();
      mockTestTriggerMutateAsync.mockResolvedValue(matchResult);
      await renderPanel();

      const input = screen.getByLabelText('Trigger phrase input');
      await user.type(input, 'overdue invoices{Enter}');

      await waitFor(() => {
        expect(mockTestTriggerMutateAsync).toHaveBeenCalledWith('overdue invoices');
      });
    });
  });
});

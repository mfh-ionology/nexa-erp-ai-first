/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiAgentDetail } from '../api/types';

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

// --- Mock hooks ---
const mockUseAiAgent = vi.fn();
const mockUseAiModels = vi.fn();
const mockUseAiPrompts = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();

vi.mock('../api/use-ai-agents', () => ({
  useAiAgent: (...args: unknown[]) => mockUseAiAgent(...args),
  useCreateAiAgent: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateAiAgent: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeleteAiAgent: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../api/use-ai-models', () => ({
  useAiModels: (...args: unknown[]) => mockUseAiModels(...args),
}));

vi.mock('../api/use-ai-prompts', () => ({
  useAiPrompts: (...args: unknown[]) => mockUseAiPrompts(...args),
}));

// --- Test data ---
const testAgent: AiAgentDetail = {
  id: 'agent-1',
  name: 'invoice-creator',
  displayName: 'Invoice Creator',
  description: 'Creates invoices',
  modelId: 'model-1',
  modelDisplayName: 'Claude Opus 4.6',
  promptId: 'prompt-1',
  promptName: 'invoice-system',
  routingTags: ['standard'],
  toolCount: 2,
  maxTurns: 10,
  isActive: true,
  tools: ['create_invoice', 'query_entity'],
  guardrails: {
    canRead: ['customers'],
    canWrite: ['invoices'],
    requiresApproval: false,
    blockedOperations: [],
    dataScope: 'own' as const,
  },
  triggerConfig: [],
  model: {
    id: 'model-1',
    name: 'claude-opus',
    displayName: 'Claude Opus 4.6',
    provider: 'anthropic',
  },
  prompt: {
    id: 'prompt-1',
    name: 'invoice-system',
    description: 'Invoice System',
    category: 'system',
  },
  automationStepCount: 0,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

function setupMocks(
  overrides: { agent?: AiAgentDetail | undefined; isLoading?: boolean; isError?: boolean } = {},
) {
  mockUseAiAgent.mockReturnValue({
    data: overrides.agent ?? undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
  mockUseAiModels.mockReturnValue({
    data: {
      data: [
        { id: 'model-1', displayName: 'Claude Opus 4.6', provider: 'anthropic', isActive: true },
      ],
    },
  });
  mockUseAiPrompts.mockReturnValue({
    data: {
      data: [{ id: 'prompt-1', name: 'invoice-system', category: 'system', isActive: true }],
    },
  });
}

// Dynamic import after mocks
async function renderPage(props: { id?: string } = {}) {
  const { AgentFormPage } = await import('./agent-form-page');
  return render(<AgentFormPage {...props} />);
}

describe('AgentFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Create mode ---

  describe('create mode (no id)', () => {
    it('renders "New Agent" heading', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('New Agent');
    });

    it('renders Main tab form fields', async () => {
      await renderPage();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Display Name')).toBeInTheDocument();
    });

    it('renders tab list with Main, Tools, Guardrails, Triggers', async () => {
      await renderPage();

      expect(screen.getByRole('tab', { name: /main/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tools/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /guardrails/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /triggers/i })).toBeInTheDocument();
    });

    it('renders Model and Prompt dropdowns', async () => {
      await renderPage();

      expect(screen.getByText('Model')).toBeInTheDocument();
      expect(screen.getByText('Prompt')).toBeInTheDocument();
    });

    it('renders Active toggle', async () => {
      await renderPage();

      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  // --- Edit mode ---

  describe('edit mode (with id)', () => {
    it('populates form with agent data', async () => {
      setupMocks({ agent: testAgent });
      await renderPage({ id: 'agent-1' });

      // Agent name field should be populated
      const nameInputs = screen.getAllByDisplayValue('invoice-creator');
      expect(nameInputs.length).toBeGreaterThan(0);
    });

    it('renders agent display name in heading', async () => {
      setupMocks({ agent: testAgent });
      await renderPage({ id: 'agent-1' });

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Invoice Creator');
    });

    it('shows Delete button in edit mode', async () => {
      setupMocks({ agent: testAgent });
      await renderPage({ id: 'agent-1' });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('shows loading skeletons when data is loading', async () => {
      setupMocks({ isLoading: true });
      await renderPage({ id: 'agent-1' });

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when agent load fails', async () => {
      setupMocks({ isError: true });
      await renderPage({ id: 'agent-1' });

      expect(screen.getByText(/failed to load agent/i)).toBeInTheDocument();
    });
  });
});

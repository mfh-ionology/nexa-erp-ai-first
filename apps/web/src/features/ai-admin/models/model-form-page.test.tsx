/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiModelDetail } from '../api/types';

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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Mock hooks ---
const mockUseAiModel = vi.fn();
const mockUseAiModels = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();

vi.mock('../api/use-ai-models', () => ({
  useAiModel: (...args: unknown[]) => mockUseAiModel(...args),
  useAiModels: (...args: unknown[]) => mockUseAiModels(...args),
  useCreateAiModel: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateAiModel: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeleteAiModel: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

// --- Test data ---
const testModel: AiModelDetail = {
  id: 'model-1',
  name: 'claude-opus',
  provider: 'anthropic',
  modelId: 'claude-opus-4-6',
  displayName: 'Claude Opus 4.6',
  maxInputTokens: 200000,
  maxOutputTokens: 32000,
  costPerMInput: '15.00',
  costPerMOutput: '75.00',
  routingTags: ['reasoning'],
  capabilities: { vision: true },
  isActive: true,
  isDefault: false,
  fallbackModelId: null,
  fallbackModel: null,
  config: null,
  agentCount: 0,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

function setupMocks(
  overrides: { model?: AiModelDetail | undefined; isLoading?: boolean; isError?: boolean } = {},
) {
  mockUseAiModel.mockReturnValue({
    data: overrides.model ?? undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
  mockUseAiModels.mockReturnValue({
    data: { data: [] },
  });
}

// Dynamic import after mocks
async function renderPage(props: { id?: string } = {}) {
  const { ModelFormPage } = await import('./model-form-page');
  return render(<ModelFormPage {...props} />);
}

describe('ModelFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Create mode ---

  describe('create mode (no id)', () => {
    it('renders "New Model" heading', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('New Model');
    });

    it('renders form fields (Name, Display Name, Provider, Model ID)', async () => {
      await renderPage();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('Provider')).toBeInTheDocument();
      expect(screen.getByText('Model ID')).toBeInTheDocument();
    });

    it('renders max token and cost fields', async () => {
      await renderPage();

      expect(screen.getByText('Max Input Tokens')).toBeInTheDocument();
      expect(screen.getByText('Max Output Tokens')).toBeInTheDocument();
      expect(screen.getByText('Cost per Million Input Tokens ($)')).toBeInTheDocument();
      expect(screen.getByText('Cost per Million Output Tokens ($)')).toBeInTheDocument();
    });

    it('renders Active and Default toggles', async () => {
      await renderPage();

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Default Model')).toBeInTheDocument();
    });

    it('Save button is disabled when form has not been modified', async () => {
      await renderPage();

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  // --- Edit mode ---

  describe('edit mode (with id)', () => {
    it('populates form with model data', async () => {
      setupMocks({ model: testModel });
      await renderPage({ id: 'model-1' });

      const nameInput = screen.getByPlaceholderText('claude-opus-4-6');
      expect(nameInput).toHaveValue('claude-opus');
    });

    it('renders model display name in heading', async () => {
      setupMocks({ model: testModel });
      await renderPage({ id: 'model-1' });

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Claude Opus 4.6');
    });

    it('shows Delete button in edit mode', async () => {
      setupMocks({ model: testModel });
      await renderPage({ id: 'model-1' });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('shows loading skeletons when data is loading', async () => {
      setupMocks({ isLoading: true });
      await renderPage({ id: 'model-1' });

      // PageHeader with isLoading renders skeleton elements
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when model load fails', async () => {
      setupMocks({ isError: true });
      await renderPage({ id: 'model-1' });

      expect(screen.getByText(/failed to load model/i)).toBeInTheDocument();
    });
  });
});

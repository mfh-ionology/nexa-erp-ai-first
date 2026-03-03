/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiSkillDetail } from '../api/types';

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
const mockUseAiSkill = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();

vi.mock('../api/use-ai-skills', () => ({
  useAiSkill: (...args: unknown[]) => mockUseAiSkill(...args),
  useCreateAiSkill: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateAiSkill: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

// --- Test data ---
const testSkill: AiSkillDetail = {
  id: 'skill-1',
  name: 'ar-overdue-analysis',
  displayName: 'Overdue Invoice Analysis',
  description: 'Analyses overdue invoices and recommends follow-up actions',
  category: 'analysis',
  moduleKey: 'ar',
  packKey: 'ar-analysis',
  triggerPhrases: ['show me overdue invoices', 'analyse overdue accounts'],
  negativeTriggers: ['create invoice'],
  orchestrationPattern: 'SEQUENTIAL',
  priority: 200,
  version: 1,
  isActive: true,
  outputType: 'json',
  requiredToolCount: 2,
  skillContent: '# Overdue Invoice Analysis\n\nAnalyse overdue invoices...',
  inputSchema: {},
  requiredTools: ['query_entity', 'analyse_data'],
  contextRequired: ['module:ar'],
  parameters: null,
  examples: null,
  contextCount: 2,
  overrideCount: 1,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

function setupMocks(
  overrides: { skill?: AiSkillDetail | undefined; isLoading?: boolean; isError?: boolean } = {},
) {
  mockUseAiSkill.mockReturnValue({
    data: overrides.skill ?? undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
}

// Dynamic import after mocks
async function renderPage(props: { id?: string } = {}) {
  const { SkillFormPage } = await import('./skill-form-page');
  return render(<SkillFormPage {...props} />);
}

describe('SkillFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Create mode ---

  describe('create mode (no id)', () => {
    it('renders "New Skill" heading', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('New Skill');
    });

    it('renders Main tab form fields', async () => {
      await renderPage();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Display Name')).toBeInTheDocument();
    });

    it('renders tab list with Main, Triggers, Content, Schema', async () => {
      await renderPage();

      expect(screen.getByRole('tab', { name: /main/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /triggers/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /content/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /schema/i })).toBeInTheDocument();
    });

    it('renders Category and Output Type selects', async () => {
      await renderPage();

      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Output Type')).toBeInTheDocument();
    });

    it('renders Active toggle', async () => {
      await renderPage();

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders Priority field', async () => {
      await renderPage();

      expect(screen.getByText('Priority')).toBeInTheDocument();
    });
  });

  // --- Edit mode ---

  describe('edit mode (with id)', () => {
    it('populates form with skill data', async () => {
      setupMocks({ skill: testSkill });
      await renderPage({ id: 'skill-1' });

      const nameInputs = screen.getAllByDisplayValue('ar-overdue-analysis');
      expect(nameInputs.length).toBeGreaterThan(0);
    });

    it('renders skill display name in heading', async () => {
      setupMocks({ skill: testSkill });
      await renderPage({ id: 'skill-1' });

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Overdue Invoice Analysis');
    });

    it('shows Deactivate button in edit mode', async () => {
      setupMocks({ skill: testSkill });
      await renderPage({ id: 'skill-1' });

      expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
    });

    it('shows version as read-only', async () => {
      setupMocks({ skill: testSkill });
      await renderPage({ id: 'skill-1' });

      // Version appears in both header badge and read-only form field
      const versionElements = screen.getAllByText('v1');
      expect(versionElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows loading skeletons when data is loading', async () => {
      setupMocks({ isLoading: true });
      await renderPage({ id: 'skill-1' });

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when skill load fails', async () => {
      setupMocks({ isError: true });
      await renderPage({ id: 'skill-1' });

      expect(screen.getByText(/failed to load skill/i)).toBeInTheDocument();
    });
  });
});

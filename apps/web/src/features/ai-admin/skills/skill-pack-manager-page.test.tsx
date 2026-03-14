/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AiSkillListItem, SkillsGroupedResponse } from '../api/types';

// --- Mock useBreakpoint ---
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

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
const mockUseAiSkills = vi.fn();
const mockUseAiSkillsGrouped = vi.fn();
const mockUpdateMutate = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockTestTriggerMutateAsync = vi.fn();

vi.mock('../api/use-ai-skills', () => ({
  useAiSkills: (...args: unknown[]) => mockUseAiSkills(...args),
  useAiSkillsGrouped: (...args: unknown[]) => mockUseAiSkillsGrouped(...args),
  useUpdateAiSkill: () => ({
    mutate: mockUpdateMutate,
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useTestTrigger: () => ({
    mutateAsync: mockTestTriggerMutateAsync,
    isPending: false,
  }),
}));

// --- Test data ---
const arSkill: AiSkillListItem = {
  id: 'skill-1',
  name: 'ar-overdue-analysis',
  displayName: 'Overdue Invoice Analysis',
  description: 'Analyses overdue invoices',
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
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

const financeSkill: AiSkillListItem = {
  id: 'skill-2',
  name: 'fin-reconciliation',
  displayName: 'Bank Reconciliation',
  description: 'Reconcile bank statements',
  category: 'financial',
  moduleKey: 'finance',
  packKey: 'fin-core',
  triggerPhrases: ['reconcile bank', 'match transactions'],
  negativeTriggers: [],
  orchestrationPattern: 'PARALLEL',
  priority: 150,
  version: 1,
  isActive: true,
  outputType: 'json',
  requiredToolCount: 3,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

const unassignedSkill: AiSkillListItem = {
  id: 'skill-3',
  name: 'general-helper',
  displayName: 'General Helper',
  description: 'General purpose assistant',
  category: 'communication',
  moduleKey: null,
  packKey: null,
  triggerPhrases: ['help me'],
  negativeTriggers: [],
  orchestrationPattern: null,
  priority: 100,
  version: 1,
  isActive: false,
  outputType: 'markdown',
  requiredToolCount: 0,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

const groupedData: SkillsGroupedResponse = {
  groups: [
    { moduleKey: 'ar', skills: [arSkill] },
    { moduleKey: 'finance', skills: [financeSkill] },
    { moduleKey: null, skills: [unassignedSkill] },
  ],
  totalCount: 3,
};

function setupMockQueries(
  overrides: { grouped?: SkillsGroupedResponse; isLoading?: boolean } = {},
) {
  mockUseAiSkillsGrouped.mockReturnValue({
    data: overrides.grouped ?? groupedData,
    isLoading: overrides.isLoading ?? false,
    isSuccess: !(overrides.isLoading ?? false),
  });
  mockUseAiSkills.mockReturnValue({
    data: { data: [arSkill, financeSkill, unassignedSkill] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isSuccess: true,
  });
}

// Dynamic import after mocks
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

async function renderPage() {
  const { SkillPackManagerPage } = await import('./skill-pack-manager-page');
  const queryClient = createTestQueryClient();
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(SkillPackManagerPage),
    ),
  );
}

describe('SkillPackManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setupMockQueries();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders page title "Skill Pack Manager"', async () => {
      await renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Skill Pack Manager');
    });

    it('renders "Add Skill" button', async () => {
      await renderPage();

      expect(screen.getByText('Add Skill')).toBeInTheDocument();
    });

    it('renders "Test Trigger" button', async () => {
      await renderPage();

      expect(screen.getByText('Test Trigger')).toBeInTheDocument();
    });
  });

  // --- Accordion view ---

  describe('accordion view (default)', () => {
    it('renders module sections as accordion items', async () => {
      await renderPage();

      expect(screen.getByText('AR')).toBeInTheDocument();
      expect(screen.getByText('FINANCE')).toBeInTheDocument();
    });

    it('renders skill names within accordion content', async () => {
      await renderPage();

      expect(screen.getByText('ar-overdue-analysis')).toBeInTheDocument();
      expect(screen.getByText('Overdue Invoice Analysis')).toBeInTheDocument();
    });

    it('renders trigger phrases as pills', async () => {
      await renderPage();

      expect(screen.getByText('show me overdue invoices')).toBeInTheDocument();
    });

    it('renders Unassigned section for null moduleKey', async () => {
      await renderPage();

      expect(screen.getByText(/Unassigned/i)).toBeInTheDocument();
      expect(screen.getByText('general-helper')).toBeInTheDocument();
    });

    it('renders orchestration pattern badges', async () => {
      await renderPage();

      expect(screen.getByText('SEQUENTIAL')).toBeInTheDocument();
      expect(screen.getByText('PARALLEL')).toBeInTheDocument();
    });
  });

  // --- Search ---

  describe('search', () => {
    it('renders search input', async () => {
      await renderPage();

      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  // --- View mode toggle ---

  describe('view mode toggle', () => {
    it('renders view toggle buttons', async () => {
      await renderPage();

      // There should be toggle buttons for Cards/List views
      const buttons = screen.getAllByRole('button');
      // At minimum: Add Skill, Test Trigger, and view toggle buttons
      expect(buttons.length).toBeGreaterThan(2);
    });
  });

  // --- Inline toggle ---

  describe('inline active toggle', () => {
    it('renders Switch toggles for each skill card', async () => {
      await renderPage();

      // Each skill card has a Switch for isActive toggle
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThanOrEqual(1);
    });
  });
});

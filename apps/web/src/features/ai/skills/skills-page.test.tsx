import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import type { ResolvedPermissions } from '@/stores/auth-store';

import type { Skill } from './types';

// jsdom polyfill for Radix UI Select pointer events
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
// jsdom does not implement scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// --- Mocks ---

const mockGetSkills = vi.fn();
const mockUpsertSkillOverride = vi.fn();
const mockDeleteSkillOverride = vi.fn();

vi.mock('../api', () => ({
  getSkills: (...args: unknown[]) => mockGetSkills(...args),
  upsertSkillOverride: (...args: unknown[]) => mockUpsertSkillOverride(...args),
  deleteSkillOverride: (...args: unknown[]) => mockDeleteSkillOverride(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { AISkillsPage } from './skills-page';

// --- Fixtures ---

const skills: Skill[] = [
  {
    id: 'skill-1',
    name: 'create-invoice',
    displayName: 'Create Invoice',
    description: 'Creates a new sales invoice',
    category: 'domain',
    moduleKey: 'finance',
    packKey: 'core-finance',
    triggerPhrases: ['create invoice', 'new invoice'],
    negativeTriggers: ['delete invoice'],
    orchestrationPattern: 'SEQUENTIAL',
    skillContent: 'Create invoice instructions',
    requiredTools: ['createInvoice'],
    parameters: null,
    examples: null,
    priority: 10,
    version: '1.0.0',
    isActive: true,
    hasOverride: false,
  },
  {
    id: 'skill-2',
    name: 'post-journal',
    displayName: 'Post Journal Entry',
    description: 'Posts a journal entry to the ledger',
    category: 'domain',
    moduleKey: 'finance',
    packKey: 'core-finance',
    triggerPhrases: ['post journal', 'journal entry'],
    negativeTriggers: [],
    orchestrationPattern: 'CONTEXT_AWARE',
    skillContent: 'Journal posting instructions',
    requiredTools: ['postJournal'],
    parameters: null,
    examples: null,
    priority: 8,
    version: '1.0.0',
    isActive: true,
    hasOverride: false,
  },
  {
    id: 'skill-3',
    name: 'create-order',
    displayName: 'Create Sales Order',
    description: 'Creates a new sales order',
    category: 'domain',
    moduleKey: 'sales',
    packKey: 'core-sales',
    triggerPhrases: ['create order', 'new sales order'],
    negativeTriggers: [],
    orchestrationPattern: 'SEQUENTIAL',
    skillContent: 'Order creation instructions',
    requiredTools: ['createOrder'],
    parameters: null,
    examples: null,
    priority: 10,
    version: '1.0.0',
    isActive: false,
    hasOverride: true,
  },
];

// --- Test helpers ---

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.JSX.Element) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function setupAuth(role: string = 'STAFF') {
  const permissions: ResolvedPermissions = {
    userId: 'user-1',
    companyId: 'company-1',
    role,
    isSuperAdmin: role === 'SUPER_ADMIN',
    accessGroups: [],
    modules: {},
    fieldOverrides: {},
    enabledModules: [],
  };
  useAuthStore.setState({
    user: { id: 'user-1', email: 'test@nexa.io', firstName: 'Test', lastName: 'User' },
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: null,
    activeCompanyId: 'company-1',
    permissions,
    isLoading: false,
    rememberMe: false,
  });
}

async function waitForSkillsLoaded() {
  await screen.findByText('Create Invoice');
}

// --- Tests ---

describe('AISkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  // --- Loading ---

  it('renders skeleton loading state during fetch', () => {
    mockGetSkills.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AISkillsPage />);

    expect(screen.getByText('skills.title')).toBeInTheDocument();
    expect(screen.queryByText('Create Invoice')).not.toBeInTheDocument();
  });

  // --- Empty state ---

  it('shows empty state when no skills exist', async () => {
    mockGetSkills.mockResolvedValue([]);

    renderWithProviders(<AISkillsPage />);

    expect(await screen.findByText('skills.noSkills')).toBeInTheDocument();
  });

  // --- Skills grouped by module ---

  it('renders skills grouped by module in accordion', async () => {
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    // Finance module section — aria-label uses the raw moduleKey ("finance")
    // because the mock t() returns the key itself, so getModuleDisplayName falls
    // back to the raw moduleKey
    const financeSection = screen.getByRole('region', { name: 'finance' });
    expect(within(financeSection).getByText('2')).toBeInTheDocument();
    expect(within(financeSection).getByText('Create Invoice')).toBeInTheDocument();
    expect(within(financeSection).getByText('Post Journal Entry')).toBeInTheDocument();

    // Sales module section
    const salesSection = screen.getByRole('region', { name: 'sales' });
    expect(within(salesSection).getByText('1')).toBeInTheDocument();
  });

  // --- Skill card content ---

  it('skill card shows name, description, trigger phrases, and pattern', async () => {
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    expect(screen.getByText('Creates a new sales invoice')).toBeInTheDocument();
    expect(screen.getByText('create invoice')).toBeInTheDocument();
    expect(screen.getByText('new invoice')).toBeInTheDocument();
    expect(screen.getAllByText('skills.patterns.SEQUENTIAL').length).toBeGreaterThanOrEqual(1);
  });

  // --- Search ---

  it('search filters skills by name/description/triggers', async () => {
    const user = userEvent.setup();
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    const searchInput = screen.getByRole('textbox', { name: 'skills.search' });
    await user.type(searchInput, 'journal');

    expect(screen.getByText('Post Journal Entry')).toBeInTheDocument();
    expect(screen.queryByText('Create Invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Sales Order')).not.toBeInTheDocument();
  });

  // --- Module filter ---

  it('module filter filters by moduleKey', async () => {
    const user = userEvent.setup();
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    // Open the module filter select
    const selectTrigger = screen.getByRole('combobox', { name: 'skills.filterByModule' });
    await user.click(selectTrigger);

    // Select "sales" module — the option text is the raw moduleKey because
    // getModuleDisplayName falls back to moduleKey in the mock
    const salesOption = await screen.findByRole('option', { name: 'sales' });
    await user.click(salesOption);

    // Only sales skills visible
    expect(screen.getByText('Create Sales Order')).toBeInTheDocument();
    expect(screen.queryByText('Create Invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Post Journal Entry')).not.toBeInTheDocument();
  });

  // --- Empty search state ---

  it('shows empty state when no skills match search', async () => {
    const user = userEvent.setup();
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    const searchInput = screen.getByRole('textbox', { name: 'skills.search' });
    await user.type(searchInput, 'xyznonexistent');

    expect(await screen.findByText('skills.noSearchResults')).toBeInTheDocument();
  });

  // --- Clicking a skill card opens detail sheet ---

  it('clicking skill card opens detail sheet', async () => {
    const user = userEvent.setup();
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    const skillCard = screen.getByRole('button', { name: /Create Invoice/ });
    await user.click(skillCard);

    // Detail sheet should open with skill content
    expect(await screen.findByText('Create invoice instructions')).toBeInTheDocument();
  });

  // --- ADMIN can toggle active/inactive and save override ---

  it('ADMIN can toggle active/inactive and save override', async () => {
    const user = userEvent.setup();
    setupAuth('ADMIN');
    mockGetSkills.mockResolvedValue(skills);
    mockUpsertSkillOverride.mockResolvedValue({
      skillId: 'skill-1',
      companyId: 'company-1',
      isActive: false,
      triggerPhrasesOverride: [],
      priorityOverride: null,
    });

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    const skillCard = screen.getByRole('button', { name: /Create Invoice/ });
    await user.click(skillCard);

    // Admin should see the active toggle switch in the sheet
    const activeSwitch = await screen.findByRole('switch', { name: 'skills.active' });
    expect(activeSwitch).toBeInTheDocument();

    // Admin should see save button
    const saveBtn = screen.getByRole('button', { name: 'skills.detail.saveOverride' });
    expect(saveBtn).toBeInTheDocument();

    await user.click(saveBtn);
    expect(mockUpsertSkillOverride).toHaveBeenCalled();
  });

  // --- STAFF sees read-only detail sheet ---

  it('STAFF sees read-only detail sheet (no save button)', async () => {
    const user = userEvent.setup();
    setupAuth('STAFF');
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    const skillCard = screen.getByRole('button', { name: /Create Invoice/ });
    await user.click(skillCard);

    // Should see close button but NOT save/override button
    expect(await screen.findByRole('button', { name: 'common:close' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'skills.detail.saveOverride' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'skills.active' })).not.toBeInTheDocument();
  });

  // --- Reset to Default ---

  it('"Reset to Default" calls DELETE on override', async () => {
    const user = userEvent.setup();
    setupAuth('ADMIN');
    mockGetSkills.mockResolvedValue(skills);
    mockDeleteSkillOverride.mockResolvedValue(undefined);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    // First expand the sales section (it may be collapsed)
    // The sales section button contains text "sales"
    const salesHeader = screen
      .getAllByRole('button')
      .find(
        (btn) => btn.textContent?.includes('sales') && btn.getAttribute('aria-expanded') !== null,
      );
    if (salesHeader && salesHeader.getAttribute('aria-expanded') === 'false') {
      await user.click(salesHeader);
    }

    // Click the skill that has an override (skill-3, in sales module)
    const skillCard = await screen.findByRole('button', { name: /Create Sales Order/ });
    await user.click(skillCard);

    // Reset to Default button should be enabled (skill has override)
    const resetBtn = await screen.findByRole('button', { name: 'skills.resetToDefault' });
    expect(resetBtn).not.toBeDisabled();

    await user.click(resetBtn);
    expect(mockDeleteSkillOverride).toHaveBeenCalledWith('skill-3');
  });

  it('"Reset to Default" is disabled when no override exists', async () => {
    const user = userEvent.setup();
    setupAuth('ADMIN');
    mockGetSkills.mockResolvedValue(skills);

    renderWithProviders(<AISkillsPage />);
    await waitForSkillsLoaded();

    const skillCard = screen.getByRole('button', { name: /Create Invoice/ });
    await user.click(skillCard);

    const resetBtn = await screen.findByRole('button', { name: 'skills.resetToDefault' });
    expect(resetBtn).toBeDisabled();
  });
});

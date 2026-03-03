import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';

import type { Memory, MemorySettings, MemoryListResponse } from './types';

// --- Mocks ---

const mockGetMemories = vi.fn();
const mockGetMemorySettings = vi.fn();
const mockUpdateMemory = vi.fn();
const mockDeleteMemory = vi.fn();
const mockForgetAllMemories = vi.fn();
const mockUpdateMemorySettings = vi.fn();

vi.mock('../api', () => ({
  getMemories: (...args: unknown[]) => mockGetMemories(...args),
  getMemorySettings: (...args: unknown[]) => mockGetMemorySettings(...args),
  updateMemory: (...args: unknown[]) => mockUpdateMemory(...args),
  deleteMemory: (...args: unknown[]) => mockDeleteMemory(...args),
  forgetAllMemories: (...args: unknown[]) => mockForgetAllMemories(...args),
  updateMemorySettings: (...args: unknown[]) => mockUpdateMemorySettings(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Use real TanStack Query with a test wrapper
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { AIMemoryPage } from './memory-page';

// --- Fixtures ---

const defaultSettings: MemorySettings = {
  userId: 'user-1',
  companyId: 'company-1',
  isEnabled: true,
  enabledCategories: ['PREFERENCE', 'WORKFLOW', 'DECISION', 'INSTRUCTION', 'ENTITY_CONTEXT'],
  retentionDays: 365,
  maxMemories: 500,
  decayHalfLifeDays: 90,
};

const memories: Memory[] = [
  {
    id: 'mem-1',
    userId: 'user-1',
    companyId: 'company-1',
    category: 'PREFERENCE',
    content: 'Prefers dark mode',
    source: 'EXPLICIT',
    importance: 0.8,
    lastAccessedAt: '2026-02-28T10:00:00Z',
    metadata: null,
    createdAt: '2026-02-25T08:00:00Z',
    updatedAt: '2026-02-28T10:00:00Z',
  },
  {
    id: 'mem-2',
    userId: 'user-1',
    companyId: 'company-1',
    category: 'WORKFLOW',
    content: 'Always creates invoices before delivery notes',
    source: 'IMPLICIT',
    importance: 0.6,
    lastAccessedAt: null,
    metadata: null,
    createdAt: '2026-02-20T09:00:00Z',
    updatedAt: '2026-02-20T09:00:00Z',
  },
  {
    id: 'mem-3',
    userId: 'user-1',
    companyId: 'company-1',
    category: 'PREFERENCE',
    content: 'Likes compact table views',
    source: 'EXPLICIT',
    importance: 0.5,
    lastAccessedAt: '2026-02-27T14:00:00Z',
    metadata: null,
    createdAt: '2026-02-24T11:00:00Z',
    updatedAt: '2026-02-27T14:00:00Z',
  },
  {
    id: 'mem-4',
    userId: 'user-1',
    companyId: 'company-1',
    category: 'DECISION',
    content: 'Decided to use FIFO for inventory costing',
    source: 'EXPLICIT',
    importance: 0.9,
    lastAccessedAt: '2026-02-26T16:00:00Z',
    metadata: null,
    createdAt: '2026-02-22T10:00:00Z',
    updatedAt: '2026-02-26T16:00:00Z',
  },
];

const emptyResponse: MemoryListResponse = { memories: [], cursor: null, total: 0 };
const populatedResponse: MemoryListResponse = {
  memories,
  cursor: null,
  total: memories.length,
};

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

function setupAuth() {
  useAuthStore.setState({
    user: { id: 'user-1', email: 'test@nexa.io', firstName: 'Test', lastName: 'User' },
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: null,
    activeCompanyId: 'company-1',
    permissions: null,
    isLoading: false,
    rememberMe: false,
  });
}

/** Wait for the memory data to finish loading (skeleton disappears, content appears). */
async function waitForDataLoaded() {
  // Memory content is wrapped in smart quotes (&ldquo;...&rdquo;) so use regex
  await screen.findByText(/Prefers dark mode/);
}

// --- Tests ---

describe('AIMemoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  // --- Loading / skeleton state ---

  it('renders skeleton loading state during fetch', () => {
    mockGetMemories.mockReturnValue(new Promise(() => {}));
    mockGetMemorySettings.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AIMemoryPage />);

    // Page title visible even during loading
    expect(screen.getByText('memory.title')).toBeInTheDocument();

    // Skeleton elements should be present (no actual memory data rendered)
    expect(screen.queryByText(/Prefers dark mode/)).not.toBeInTheDocument();
  });

  // --- Empty state ---

  it('shows empty state when no memories exist', async () => {
    mockGetMemories.mockResolvedValue(emptyResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);

    expect(await screen.findByText('memory.noMemories')).toBeInTheDocument();
    expect(screen.getByText('memory.noMemoriesDesc')).toBeInTheDocument();
  });

  // --- Settings panel ---

  it('renders memory settings panel with toggle, categories, and retention', async () => {
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // Enable toggle switch is present
    const toggle = screen.getByRole('switch', { name: 'memory.settings.enableAiMemory' });
    expect(toggle).toBeInTheDocument();

    // Category labels (appear in both the settings checkboxes AND the filter pills,
    // so use getAllByText for categories that appear in both contexts)
    expect(screen.getAllByText('memory.settings.preference').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('memory.settings.workflow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('memory.settings.decision').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('memory.settings.instruction').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('memory.settings.entityContext').length).toBeGreaterThanOrEqual(1);

    // Retention selector label
    expect(screen.getByText('memory.settings.retention')).toBeInTheDocument();
  });

  it('settings toggle calls PATCH /memories/settings', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);
    mockUpdateMemorySettings.mockResolvedValue({ ...defaultSettings, isEnabled: false });

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    const toggle = screen.getByRole('switch', { name: 'memory.settings.enableAiMemory' });
    await user.click(toggle);

    expect(mockUpdateMemorySettings).toHaveBeenCalledWith({ isEnabled: false });
  });

  // --- Memory list grouped by category ---

  it('renders memory list grouped by category', async () => {
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // All 4 memories visible (content wrapped in smart quotes, use regex)
    expect(screen.getByText(/Prefers dark mode/)).toBeInTheDocument();
    expect(screen.getByText(/Always creates invoices before delivery notes/)).toBeInTheDocument();
    expect(screen.getByText(/Likes compact table views/)).toBeInTheDocument();
    expect(screen.getByText(/Decided to use FIFO for inventory costing/)).toBeInTheDocument();

    // Category sections exist with count badges
    // Sections use <section aria-label="..."> so look for them by label text
    const sections = screen.getAllByRole('region');
    expect(sections.length).toBeGreaterThanOrEqual(3); // PREFERENCE, WORKFLOW, DECISION

    // Each section has a count badge — check via expand/collapse buttons
    const expandButtons = screen.getAllByRole('button', { expanded: true });
    // There should be collapse buttons for each category group
    expect(expandButtons.length).toBeGreaterThanOrEqual(3);
  });

  // --- Search / filter ---

  it('search filters memories by content (case-insensitive)', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    const searchInput = screen.getByRole('textbox', { name: 'memory.search' });
    await user.type(searchInput, 'dark');

    // Only the matching memory should remain visible
    expect(screen.getByText(/Prefers dark mode/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Always creates invoices before delivery notes/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Decided to use FIFO for inventory costing/)).not.toBeInTheDocument();
  });

  it('category filter pills filter memories', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // Click the WORKFLOW filter pill (aria-pressed button)
    const filterPills = screen.getAllByRole('button', { pressed: false });
    const workflowPill = filterPills.find((btn) => btn.textContent === 'memory.settings.workflow');
    expect(workflowPill).toBeTruthy();
    await user.click(workflowPill!);

    // Only workflow memories should be visible
    expect(screen.getByText(/Always creates invoices before delivery notes/)).toBeInTheDocument();
    expect(screen.queryByText(/Prefers dark mode/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Decided to use FIFO for inventory costing/)).not.toBeInTheDocument();
  });

  it('shows no-results state when search matches nothing', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    const searchInput = screen.getByRole('textbox', { name: 'memory.search' });
    await user.type(searchInput, 'xyznonexistent');

    expect(await screen.findByText('memory.noSearchResults')).toBeInTheDocument();
  });

  // --- Edit dialog ---

  it('edit dialog opens with memory content and save calls PATCH', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);
    mockUpdateMemory.mockResolvedValue({ ...memories[0], content: 'Updated content' });

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // Click edit button on the first memory card
    const editButtons = screen.getAllByRole('button', { name: 'memory.edit' });
    await user.click(editButtons[0]!);

    // Dialog should appear with edit title
    expect(await screen.findByText('memory.editTitle')).toBeInTheDocument();

    // Textarea should contain the memory content
    const textarea = screen.getByRole('textbox', { name: 'memory.editTitle' });
    expect(textarea).toHaveValue('Prefers dark mode');

    // Modify and save
    await user.clear(textarea);
    await user.type(textarea, 'Updated content');

    const saveBtn = screen.getByRole('button', { name: 'common:save' });
    await user.click(saveBtn);

    expect(mockUpdateMemory).toHaveBeenCalledWith('mem-1', 'Updated content');
  });

  // --- Delete dialog ---

  it('delete dialog shows confirmation and confirm calls DELETE', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);
    mockDeleteMemory.mockResolvedValue(undefined);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // Click delete button on the first memory card
    const deleteButtons = screen.getAllByRole('button', { name: 'memory.deleteTitle' });
    await user.click(deleteButtons[0]!);

    // Dialog should appear
    expect(await screen.findByText('memory.deleteConfirm')).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: 'common:delete' });
    await user.click(confirmBtn);

    expect(mockDeleteMemory).toHaveBeenCalledWith('mem-1');
  });

  // --- Forget-all dialog ---

  it('forget-all dialog requires typing "FORGET" to enable confirm', async () => {
    const user = userEvent.setup();
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);
    mockForgetAllMemories.mockResolvedValue(undefined);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // Click the Forget Everything button (in settings panel danger zone)
    const forgetBtn = screen.getByRole('button', { name: 'memory.settings.forgetAll' });
    await user.click(forgetBtn);

    // Dialog should appear — the body text appears in both settings panel and dialog
    const bodyTexts = await screen.findAllByText('memory.forgetAllBody');
    expect(bodyTexts.length).toBeGreaterThanOrEqual(2);

    // Confirm button should be disabled initially
    // The confirm button label is the forgetAllTitle i18n key
    const confirmBtns = screen.getAllByRole('button', { name: 'memory.forgetAllTitle' });
    // Last one is the dialog's confirm button (destructive variant with disabled)
    const confirmBtn = confirmBtns[confirmBtns.length - 1]!;
    expect(confirmBtn).toBeDisabled();

    // Type the confirmation word (mock t returns the key itself)
    const confirmInput = screen.getByRole('textbox', { name: 'memory.forgetAllConfirmLabel' });
    await user.type(confirmInput, 'memory.forgetAllConfirmWord');

    // Now confirm button should be enabled
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);
    expect(mockForgetAllMemories).toHaveBeenCalled();
  });

  // --- Stats panel ---

  it('stats panel shows correct counts', async () => {
    mockGetMemories.mockResolvedValue(populatedResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);
    await waitForDataLoaded();

    // Stats panel heading
    expect(screen.getByText('memory.stats.total')).toBeInTheDocument();

    // Total count (4 memories) — the bold number
    expect(screen.getByText('4')).toBeInTheDocument();

    // Source breakdown labels
    expect(screen.getByText('memory.stats.explicit')).toBeInTheDocument();
    expect(screen.getByText('memory.stats.learned')).toBeInTheDocument();
  });

  it('stats panel is hidden when no memories exist', async () => {
    mockGetMemories.mockResolvedValue(emptyResponse);
    mockGetMemorySettings.mockResolvedValue(defaultSettings);

    renderWithProviders(<AIMemoryPage />);

    // Wait for loading to finish — empty state renders
    expect(await screen.findByText('memory.noMemories')).toBeInTheDocument();

    // Stats panel heading should NOT be present (stats panel returns null when total=0)
    expect(screen.queryByText('memory.stats.total')).not.toBeInTheDocument();
    expect(screen.queryByText('memory.stats.explicit')).not.toBeInTheDocument();
    expect(screen.queryByText('memory.stats.learned')).not.toBeInTheDocument();
  });
});

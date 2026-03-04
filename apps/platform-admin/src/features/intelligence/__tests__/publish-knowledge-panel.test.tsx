/* eslint-disable i18next/no-literal-string */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean; user: { id: string; role: string } }) => unknown) =>
      selector({ isAuthenticated: true, user: { id: 'admin-1', role: 'PLATFORM_ADMIN' } }),
  ),
}));

const mockCreateMutate = vi.fn();
const mockPublishMutate = vi.fn();
const mockUpdateInsightMutate = vi.fn();

vi.mock('@/api/use-platform-knowledge', () => ({
  useCreateKnowledgeArticle: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  usePublishKnowledgeArticle: () => ({
    mutate: mockPublishMutate,
    isPending: false,
  }),
}));

vi.mock('@/api/use-intelligence', () => ({
  useUpdateInsightStatus: () => ({
    mutate: mockUpdateInsightMutate,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PublishKnowledgePanel } from '../components/publish-knowledge-panel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPanel(props: Partial<React.ComponentProps<typeof PublishKnowledgePanel>> = {}) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    ...props,
  };

  return render(<PublishKnowledgePanel {...defaultProps} />, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublishKnowledgePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields when open', () => {
    renderPanel();

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByText('Save as Draft')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderPanel({ isOpen: false });

    expect(screen.queryByText('Publish Knowledge')).not.toBeInTheDocument();
  });

  it('validates required fields before submission', async () => {
    const user = userEvent.setup();
    renderPanel();

    // Click "Publish" without filling anything
    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    // Should show validation errors
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Content is required')).toBeInTheDocument();

    // Should NOT call create mutation
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('validates title length exceeding max', async () => {
    const user = userEvent.setup();
    renderPanel();

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    // Use fireEvent to bypass maxLength constraint (simulates programmatic value setting)
    // First remove the maxLength attribute so we can type past it
    titleInput.removeAttribute('maxLength');
    await user.clear(titleInput);
    // Paste a long string instead of typing char by char (much faster)
    await user.click(titleInput);
    await user.paste('A'.repeat(501));

    // Fill content too
    const contentInput = screen.getByLabelText(/content/i);
    await user.type(contentInput, 'Some content');

    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    expect(screen.getByText(/title must be 500 characters or fewer/i)).toBeInTheDocument();
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('pre-fills from correction/insight context', () => {
    renderPanel({
      prefill: {
        title: 'AI Correction: TERMINOLOGY — ar.aging_report',
        content: 'Users often refer to "aged debtors" instead of "aging report"',
        category: 'BEST_PRACTICE',
        sourceInsightId: 'insight-1',
      },
    });

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('AI Correction: TERMINOLOGY — ar.aging_report');

    const contentInput = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
    expect(contentInput.value).toBe(
      'Users often refer to "aged debtors" instead of "aging report"',
    );
  });

  it('calls create mutation with correct body on "Save as Draft"', async () => {
    vi.useFakeTimers();
    renderPanel();

    // Wait for the auto-focus timer (150ms) to complete before interacting
    vi.advanceTimersByTime(200);

    vi.useRealTimers();
    const user2 = userEvent.setup();

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    const contentInput = screen.getByLabelText(/content/i) as HTMLTextAreaElement;

    // Use fireEvent.change for reliability (avoids focus-stealing from useEffect)
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(titleInput, { target: { value: 'Test Article' } });
    fireEvent.change(contentInput, { target: { value: 'Article content here' } });

    await user2.selectOptions(screen.getByLabelText(/category/i), 'HELP');

    await user2.click(screen.getByText('Save as Draft'));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      {
        title: 'Test Article',
        content: 'Article content here',
        category: 'HELP',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('calls create mutation on "Publish"', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/title/i), 'Test Article');
    await user.type(screen.getByLabelText(/content/i), 'Article content here');

    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Article',
        content: 'Article content here',
        category: 'BEST_PRACTICE',
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
  });

  it('toggles between edit and preview mode', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/content/i), '## Hello World');

    // Click Preview
    await user.click(screen.getByText('Preview'));

    // Should show rendered content, not textarea
    expect(screen.queryByLabelText(/content/i)).not.toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();

    // Click Edit to go back
    await user.click(screen.getByText('Edit'));
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
  });

  it('closes on escape key', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has dialog role and aria-modal', () => {
    renderPanel();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Publish Knowledge Article');
  });
});

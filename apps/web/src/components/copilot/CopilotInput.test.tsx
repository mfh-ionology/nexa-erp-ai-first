import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useCopilotStore } from '@/stores/copilot-store';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from 'sonner';

// Mock useAiChat to prevent WebSocket creation in tests
vi.mock('@/hooks/use-ai-chat', () => ({
  useAiChat: () => ({
    sendMessage: vi.fn(),
    confirmAction: vi.fn(),
    rejectAction: vi.fn(),
    connectionStatus: 'disconnected' as const,
    isConnected: false,
  }),
}));

import { CopilotInput } from './CopilotInput';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      // @ts-expect-error dual @types/react versions
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
    queryClient,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CopilotInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCopilotStore.setState({
      pendingInput: '',
      messages: [],
      sessionMessages: {},
      isStreaming: false,
      connectionStatus: 'disconnected',
      isDrawerOpen: true,
      activeConversationId: null,
      sessions: [],
      isMinimised: false,
      currentContext: null,
    });
  });

  it('renders textarea with correct placeholder', () => {
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    expect(textarea).toHaveAttribute('placeholder', 'copilot.inputPlaceholder');
  });

  it('Enter key submits message (calls addMessage)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    await user.type(textarea, 'hello');

    // EntityMentionInput manages its own state; verify the textarea has the typed value
    expect(textarea).toHaveValue('hello');

    await user.keyboard('{Enter}');

    // Message should be added to store
    const messages = useCopilotStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('hello');
    expect(messages[0]?.role).toBe('user');

    // Input should be cleared after send
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter does not submit (inserts new line)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    await user.type(textarea, 'hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // No message should have been added
    expect(useCopilotStore.getState().messages).toHaveLength(0);
    // Input should still contain text (not cleared)
    expect((textarea as HTMLTextAreaElement).value).toContain('hello');
  });

  it('submit button disabled when input is empty', () => {
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    expect(sendBtn).toBeDisabled();
  });

  it('submit button disabled when isStreaming', () => {
    useCopilotStore.setState({ isStreaming: true });
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    expect(sendBtn).toBeDisabled();
  });

  it('submit button enabled when input has text and not streaming', async () => {
    const user = userEvent.setup();
    useCopilotStore.setState({ isStreaming: false });
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    await user.type(textarea, 'hello');

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    expect(sendBtn).not.toBeDisabled();
  });

  it('file drag shows drop zone overlay', () => {
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    // The drop zone is the outermost div wrapping the textarea
    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    const dropZone = textarea.parentElement!.parentElement!.parentElement!;

    fireEvent.dragOver(dropZone);

    expect(screen.getByText('copilot.fileDropZone')).toBeInTheDocument();
  });

  it('file drop shows toast message', () => {
    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    const dropZone = textarea.parentElement!.parentElement!.parentElement!;

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [new File([''], 'test.pdf')] },
    });

    expect(toast.info).toHaveBeenCalledWith('copilot.fileDropNotReady');
  });

  it('clicking submit button sends message', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CopilotInput sendMessage={vi.fn()} isConnected={true} />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    await user.type(textarea, 'test message');

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    await user.click(sendBtn);

    const messages = useCopilotStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('test message');
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { CopilotInput } from './CopilotInput';

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
    render(<CopilotInput />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    expect(textarea).toHaveAttribute(
      'placeholder',
      'copilot.inputPlaceholder',
    );
  });

  it('Enter key submits message (calls addMessage)', async () => {
    const user = userEvent.setup();
    render(<CopilotInput />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    await user.type(textarea, 'hello');

    expect(useCopilotStore.getState().pendingInput).toBe('hello');

    await user.keyboard('{Enter}');

    // Message should be added to store
    const messages = useCopilotStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('hello');
    expect(messages[0]?.role).toBe('user');

    // Input should be cleared
    expect(useCopilotStore.getState().pendingInput).toBe('');
  });

  it('Shift+Enter does not submit (inserts new line)', async () => {
    const user = userEvent.setup();
    render(<CopilotInput />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    await user.type(textarea, 'hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // No message should have been added
    expect(useCopilotStore.getState().messages).toHaveLength(0);
    // Input should still contain text
    expect(useCopilotStore.getState().pendingInput).toContain('hello');
  });

  it('submit button disabled when input is empty', () => {
    render(<CopilotInput />);

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    expect(sendBtn).toBeDisabled();
  });

  it('submit button disabled when isStreaming', () => {
    useCopilotStore.setState({ pendingInput: 'hello', isStreaming: true });
    render(<CopilotInput />);

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    expect(sendBtn).toBeDisabled();
  });

  it('submit button enabled when input has text and not streaming', () => {
    useCopilotStore.setState({ pendingInput: 'hello', isStreaming: false });
    render(<CopilotInput />);

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    expect(sendBtn).not.toBeDisabled();
  });

  it('file drag shows drop zone overlay', () => {
    render(<CopilotInput />);

    // The drop zone is the outermost div wrapping the textarea
    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    const dropZone = textarea.parentElement!.parentElement!;

    fireEvent.dragOver(dropZone);

    expect(screen.getByText('copilot.fileDropZone')).toBeInTheDocument();
  });

  it('file drop shows toast message', () => {
    render(<CopilotInput />);

    const textarea = screen.getByRole('textbox', {
      name: 'copilot.inputAriaLabel',
    });
    const dropZone = textarea.parentElement!.parentElement!;

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [new File([''], 'test.pdf')] },
    });

    expect(toast.info).toHaveBeenCalledWith('copilot.fileDropNotReady');
  });

  it('clicking submit button sends message', async () => {
    const user = userEvent.setup();
    useCopilotStore.setState({ pendingInput: 'test message' });

    render(<CopilotInput />);

    const sendBtn = screen.getByRole('button', { name: 'copilot.send' });
    await user.click(sendBtn);

    const messages = useCopilotStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('test message');
  });
});

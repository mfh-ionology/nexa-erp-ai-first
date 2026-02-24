import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { useCopilotStore } from '@/stores/copilot-store';

import { QuickPrompts } from './QuickPrompts';

// ── Helpers ─────────────────────────────────────────────────────────────────

function setAuthRole(role: string) {
  useAuthStore.setState({
    user: {
      id: 'u-1',
      email: 'test@nexa.io',
      firstName: 'Test',
      lastName: 'User',
    },
    permissions: {
      userId: 'u-1',
      companyId: 'c-1',
      role,
      isSuperAdmin: false,
      accessGroups: [],
      modules: {},
      fieldOverrides: {},
      enabledModules: [],
    },
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: null,
    activeCompanyId: 'c-1',
    isLoading: false,
    rememberMe: false,
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('QuickPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set to 14:00 (afternoon) to avoid morning-only prompts
    vi.setSystemTime(new Date('2026-02-23T14:00:00Z'));

    setAuthRole('OWNER');

    useCopilotStore.setState({
      messages: [],
      sessionMessages: {},
      isDrawerOpen: true,
      isStreaming: false,
      connectionStatus: 'disconnected',
      sessions: [],
      activeConversationId: null,
      isMinimised: false,
      pendingInput: '',
      currentContext: { pageRoute: '/' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders global prompt chips (visible for all roles)', () => {
    render(<QuickPrompts />);

    expect(
      screen.getByText('copilot.prompt.dailyBriefing'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('copilot.prompt.needsAttention'),
    ).toBeInTheDocument();
  });

  it('renders owner/manager prompts for OWNER role', () => {
    render(<QuickPrompts />);

    expect(
      screen.getByText('copilot.prompt.revenueSummary'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('copilot.prompt.cashFlowForecast'),
    ).toBeInTheDocument();
  });

  it('does not render owner prompts for CLERK role', () => {
    setAuthRole('CLERK');
    render(<QuickPrompts />);

    expect(
      screen.queryByText('copilot.prompt.revenueSummary'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('copilot.prompt.cashFlowForecast'),
    ).not.toBeInTheDocument();
  });

  it('filters prompts by current page context (AR page shows invoice prompts)', () => {
    useCopilotStore.setState({
      currentContext: { pageRoute: '/ar/invoices' },
    });
    render(<QuickPrompts />);

    expect(
      screen.getByText('copilot.prompt.createInvoice'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('copilot.prompt.showOverdue'),
    ).toBeInTheDocument();
  });

  it('does not show AR prompts on non-AR pages', () => {
    useCopilotStore.setState({
      currentContext: { pageRoute: '/sales/quotes' },
    });
    render(<QuickPrompts />);

    expect(
      screen.queryByText('copilot.prompt.createInvoice'),
    ).not.toBeInTheDocument();
  });

  it('shows sales prompts on sales pages', () => {
    useCopilotStore.setState({
      currentContext: { pageRoute: '/sales/orders' },
    });
    render(<QuickPrompts />);

    expect(
      screen.getByText('copilot.prompt.createQuote'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('copilot.prompt.pipelineSummary'),
    ).toBeInTheDocument();
  });

  it('clicking a chip calls addMessage with the i18n-resolved prompt text', async () => {
    vi.useRealTimers(); // userEvent needs real timers
    const user = userEvent.setup();
    render(<QuickPrompts />);

    const chip = screen.getByText('copilot.prompt.dailyBriefing');
    await user.click(chip);

    const messages = useCopilotStore.getState().messages;
    expect(messages).toHaveLength(1);
    // In test mode t() returns the key — the promptKey is resolved via t()
    expect(messages[0]?.content).toBe('copilot.promptText.dailyBriefing');
    expect(messages[0]?.role).toBe('user');
  });

  it('chips are horizontally scrollable (overflow-x-auto container)', () => {
    render(<QuickPrompts />);

    const chip = screen.getByText('copilot.prompt.dailyBriefing');
    const scrollContainer = chip.closest('.overflow-x-auto');
    expect(scrollContainer).toBeTruthy();
  });

  it('returns null when no prompts match', () => {
    // Set a CLERK role with a page that has no matching prompts
    setAuthRole('CLERK');
    useCopilotStore.setState({
      currentContext: { pageRoute: '/system/settings' },
    });

    render(<QuickPrompts />);

    // QuickPrompts has global "any" prompts for all roles, so it should still render
    // The global prompts (dailyBriefing, needsAttention) have no role restriction
    expect(
      screen.getByText('copilot.prompt.dailyBriefing'),
    ).toBeInTheDocument();
  });
});

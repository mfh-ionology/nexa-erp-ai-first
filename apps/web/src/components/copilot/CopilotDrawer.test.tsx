import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Breakpoint } from '@/hooks/use-breakpoint';
import { useCopilotStore } from '@/stores/copilot-store';

// ── Mock child components (isolate CopilotDrawer unit) ──────────────────────

vi.mock('./ChatHistory', () => ({
  ChatHistory: () => <div data-testid="chat-history">ChatHistory</div>,
}));

vi.mock('./CopilotChat', () => ({
  CopilotChat: () => <div data-testid="copilot-chat">CopilotChat</div>,
}));

vi.mock('./QuickPrompts', () => ({
  QuickPrompts: () => <div data-testid="quick-prompts">QuickPrompts</div>,
}));

vi.mock('./CopilotInput', () => ({
  CopilotInput: () => <div data-testid="copilot-input">CopilotInput</div>,
}));

// ── Mock useBreakpoint to control responsive behaviour ──────────────────────

let mockBreakpoint: Breakpoint = 'desktop';

vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockBreakpoint,
  usePrefersReducedMotion: () => false,
}));

import { CopilotDrawer } from './CopilotDrawer';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CopilotDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBreakpoint = 'desktop';
    useCopilotStore.setState({
      isDrawerOpen: false,
      activeConversationId: null,
      isStreaming: false,
      connectionStatus: 'disconnected',
      messages: [],
      sessionMessages: {},
      sessions: [],
      isMinimised: false,
      pendingInput: '',
      currentContext: null,
    });
  });

  describe('open/close', () => {
    it('renders child components when isDrawerOpen is true', () => {
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      expect(screen.getByTestId('chat-history')).toBeInTheDocument();
      expect(screen.getByTestId('copilot-chat')).toBeInTheDocument();
      expect(screen.getByTestId('quick-prompts')).toBeInTheDocument();
      expect(screen.getByTestId('copilot-input')).toBeInTheDocument();
    });

    it('does not render children when isDrawerOpen is false', () => {
      useCopilotStore.setState({ isDrawerOpen: false });
      render(<CopilotDrawer />);

      expect(
        screen.queryByTestId('chat-history'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('copilot-chat'),
      ).not.toBeInTheDocument();
    });

    it('close button calls closeDrawer()', async () => {
      const user = userEvent.setup();
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      const closeBtn = screen.getByRole('button', {
        name: 'copilot.close',
      });
      await user.click(closeBtn);

      expect(useCopilotStore.getState().isDrawerOpen).toBe(false);
    });

    it('Escape key closes the drawer on desktop', () => {
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(useCopilotStore.getState().isDrawerOpen).toBe(false);
    });
  });

  describe('desktop layout', () => {
    it('renders as inline panel with w-[380px] class', () => {
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      const drawer = screen.getByRole('complementary');
      expect(drawer.className).toContain('w-[380px]');
    });

    it('has w-0 class when closed', () => {
      useCopilotStore.setState({ isDrawerOpen: false });
      render(<CopilotDrawer />);

      const drawer = screen.getByRole('complementary');
      expect(drawer.className).toContain('w-0');
    });
  });

  describe('phone layout', () => {
    it('renders as full-screen overlay on phone', () => {
      mockBreakpoint = 'phone';
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      // On phone, the drawer uses a custom full-screen overlay with role="complementary"
      expect(screen.getByRole('complementary')).toBeInTheDocument();
      // Children should still render
      expect(screen.getByTestId('chat-history')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="complementary" on desktop', () => {
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      const drawer = screen.getByRole('complementary');
      expect(drawer).toBeInTheDocument();
    });

    it('has aria-label on desktop', () => {
      useCopilotStore.setState({ isDrawerOpen: true });
      render(<CopilotDrawer />);

      const drawer = screen.getByRole('complementary');
      expect(drawer).toHaveAttribute('aria-label', 'copilot.drawerLabel');
    });
  });
});

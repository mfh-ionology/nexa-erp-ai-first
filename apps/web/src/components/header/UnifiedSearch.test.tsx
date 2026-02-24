import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useCopilotStore } from '@/stores/copilot-store';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

import { UnifiedSearch } from './UnifiedSearch';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Opens the popover by clicking the anchor and waits for the cmdk input
 * to appear in the DOM.
 */
async function openAndGetInput(): Promise<HTMLInputElement> {
  const combobox = screen.getByRole('combobox', { name: 'search.ariaLabel' });
  fireEvent.click(combobox);

  await waitFor(() => {
    expect(
      document.querySelector('[data-slot="command-input"]'),
    ).toBeTruthy();
  });

  return document.querySelector(
    '[data-slot="command-input"]',
  ) as HTMLInputElement;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UnifiedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCopilotStore.setState({
      isDrawerOpen: false,
      messages: [],
      sessionMessages: {},
      sessions: [],
      pendingInput: '',
      activeConversationId: null,
      isStreaming: false,
      connectionStatus: 'disconnected',
      isMinimised: false,
      currentContext: null,
    });
  });

  describe('keyboard shortcuts', () => {
    it('Cmd+K opens the command palette popover', async () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });
      expect(combobox).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(combobox).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('Ctrl+K opens the command palette popover (Windows)', async () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });

      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(combobox).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('Escape closes the popover', async () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });

      // Open
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      await waitFor(() => {
        expect(combobox).toHaveAttribute('aria-expanded', 'true');
      });

      // Escape on the cmdk input
      const input = document.querySelector('[data-slot="command-input"]');
      expect(input).toBeTruthy();
      fireEvent.keyDown(input!, { key: 'Escape' });

      await waitFor(() => {
        expect(combobox).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('input detection', () => {
    it('typing "INV-" shows entity search results section', async () => {
      render(<UnifiedSearch />);

      const input = await openAndGetInput();
      fireEvent.change(input, { target: { value: 'INV-' } });

      await waitFor(() => {
        expect(screen.getByText('search.entities')).toBeInTheDocument();
      });
    });

    it('typing "invoices" shows page navigation results section', async () => {
      render(<UnifiedSearch />);

      const input = await openAndGetInput();
      fireEvent.change(input, { target: { value: 'invoices' } });

      await waitFor(() => {
        expect(screen.getByText('search.pages')).toBeInTheDocument();
      });
    });

    it('typing "create an invoice for Acme" shows AI suggestions section', async () => {
      render(<UnifiedSearch />);

      const input = await openAndGetInput();
      fireEvent.change(input, {
        target: { value: 'create an invoice for Acme' },
      });

      await waitFor(() => {
        expect(screen.getByText('search.askAi')).toBeInTheDocument();
      });
    });

    it('empty input shows rotating placeholder hints', async () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });
      fireEvent.click(combobox);

      await waitFor(() => {
        const input = document.querySelector(
          '[data-slot="command-input"]',
        ) as HTMLInputElement;
        expect(input).toBeTruthy();
        // When input is empty and focused, rotating hint is shown as placeholder
        expect(input.placeholder).toBe('search.rotatingHint1');
      });
    });
  });

  describe('navigation', () => {
    it('clicking a page result navigates to the page', async () => {
      const user = userEvent.setup();
      render(<UnifiedSearch />);

      const input = await openAndGetInput();
      fireEvent.change(input, { target: { value: 'invoices' } });

      await waitFor(() => {
        expect(screen.getByText('search.pages')).toBeInTheDocument();
      });

      // Find cmdk option items and click the first page result
      const options = screen.getAllByRole('option');
      const pageOption = options.find(
        (opt) =>
          opt.textContent?.includes('invoices') &&
          !opt.getAttribute('data-disabled'),
      );

      if (pageOption) {
        await user.click(pageOption);
        expect(mockNavigate).toHaveBeenCalled();
      }
    });

    it('clicking an AI suggestion opens the Co-Pilot drawer and adds message', async () => {
      const user = userEvent.setup();
      render(<UnifiedSearch />);

      const input = await openAndGetInput();
      fireEvent.change(input, {
        target: { value: 'create an invoice for Acme' },
      });

      await waitFor(() => {
        expect(screen.getByText('search.askAi')).toBeInTheDocument();
      });

      // Find and click the send-as-AI item (fallback at bottom)
      const sendAiItem = document.querySelector(
        '[data-value="send-ai-query"]',
      );
      if (sendAiItem) {
        await user.click(sendAiItem);
      }

      // Drawer should be open
      expect(useCopilotStore.getState().isDrawerOpen).toBe(true);
      // Message should be added
      expect(
        useCopilotStore.getState().messages.length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('accessibility', () => {
    it('has role="combobox" on the search input', () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });
      expect(combobox).toBeInTheDocument();
    });

    it('aria-expanded toggles with popover state', async () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });

      expect(combobox).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      await waitFor(() => {
        expect(combobox).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('aria-label is present on the search input', () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });
      expect(combobox).toHaveAttribute('aria-label', 'search.ariaLabel');
    });

    it('aria-controls references the results popover', () => {
      render(<UnifiedSearch />);

      const combobox = screen.getByRole('combobox', {
        name: 'search.ariaLabel',
      });
      expect(combobox).toHaveAttribute(
        'aria-controls',
        'unified-search-results',
      );
    });
  });
});

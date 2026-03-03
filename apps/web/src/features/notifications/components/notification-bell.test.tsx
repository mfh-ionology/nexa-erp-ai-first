/* eslint-disable i18next/no-literal-string */

/**
 * Unit tests for the NotificationBell component.
 *
 * Covers:
 * - Renders with 0 count (no badge visible)
 * - Renders with count > 0 (badge visible with correct number)
 * - Renders "99+" for count > 99
 * - Click toggles the notification dropdown
 *
 * E9-2 Task 12.2
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useNotificationStore } from '@/stores/notification-store';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'notifications:ariaLabel' && opts?.count !== undefined) {
        return `Notifications, ${opts.count} unread`;
      }
      return key;
    },
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { NotificationBell } from './notification-bell';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    isDropdownOpen: false,
    isLoading: false,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationBell', () => {
  describe('renders with 0 count (no badge)', () => {
    it('should not show badge when unread count is 0', () => {
      useNotificationStore.setState({ unreadCount: 0 });

      render(<NotificationBell />);

      const button = screen.getByRole('button', { name: 'Notifications, 0 unread' });
      expect(button).toBeInTheDocument();

      // No badge span should be rendered (the span only renders when count > 0)
      const badge = button.querySelector('span');
      expect(badge).toBeNull();
    });

    it('should render the bell icon', () => {
      useNotificationStore.setState({ unreadCount: 0 });

      render(<NotificationBell />);

      // Bell icon is rendered as an SVG inside the button
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('renders with count > 0 (badge visible)', () => {
    it('should show badge with count when unread count is 1', () => {
      useNotificationStore.setState({ unreadCount: 1 });

      render(<NotificationBell />);

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should show badge with count when unread count is 42', () => {
      useNotificationStore.setState({ unreadCount: 42 });

      render(<NotificationBell />);

      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should show badge with count when unread count is 99', () => {
      useNotificationStore.setState({ unreadCount: 99 });

      render(<NotificationBell />);

      expect(screen.getByText('99')).toBeInTheDocument();
    });

    it('should have destructive background on badge', () => {
      useNotificationStore.setState({ unreadCount: 5 });

      render(<NotificationBell />);

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('bg-destructive');
    });
  });

  describe('renders "99+" for count > 99', () => {
    it('should show "99+" when unread count is 100', () => {
      useNotificationStore.setState({ unreadCount: 100 });

      render(<NotificationBell />);

      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should show "99+" when unread count is 999', () => {
      useNotificationStore.setState({ unreadCount: 999 });

      render(<NotificationBell />);

      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  // NOTE: Click-to-toggle-dropdown is NOT tested here. NotificationBell has no
  // onClick handler — dropdown open/close is controlled by Radix Popover's
  // onOpenChange in NotificationDropdown. Toggle behaviour is tested in
  // notification-dropdown.test.tsx where the Popover wrapper is present.

  describe('aria-expanded reflects store state', () => {
    it('should have aria-expanded=false when dropdown is closed', () => {
      useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false });

      render(<NotificationBell />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-expanded=true when dropdown is open', () => {
      useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: true });

      render(<NotificationBell />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('accessibility', () => {
    it('should have correct aria-label with unread count', () => {
      useNotificationStore.setState({ unreadCount: 7 });

      render(<NotificationBell />);

      const button = screen.getByRole('button', { name: 'Notifications, 7 unread' });
      expect(button).toBeInTheDocument();
    });

    it('should have type="button"', () => {
      render(<NotificationBell />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });
});

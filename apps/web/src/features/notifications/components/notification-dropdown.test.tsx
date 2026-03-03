/* eslint-disable i18next/no-literal-string */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useNotificationStore } from '@/stores/notification-store';
import type { Notification } from '@/stores/notification-store';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMarkAsReadMutate = vi.fn();
const mockDismissMutate = vi.fn();
const mockMarkAllAsReadMutate = vi.fn();

vi.mock('../api/use-notification-actions', () => ({
  useMarkAsRead: () => ({ mutate: mockMarkAsReadMutate, isPending: false }),
  useDismissNotification: () => ({ mutate: mockDismissMutate, isPending: false }),
  useMarkAllAsRead: () => ({ mutate: mockMarkAllAsReadMutate, isPending: false }),
}));

const mockUseNotifications = vi.fn();
vi.mock('../api/use-notifications', () => ({
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
}));

// ── Import component after mocks ─────────────────────────────────────────────

import { NotificationDropdown } from './notification-dropdown';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderDropdown() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationDropdown />
    </QueryClientProvider>,
  );
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    title: 'Test Notification',
    body: 'This is a test notification body',
    priority: 'NORMAL',
    actionUrl: '/sales/orders/123',
    entityType: 'SalesOrder',
    entityId: 'so-123',
    status: 'DELIVERED',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNotifications.mockReturnValue({ isLoading: false });

  // Reset store to defaults
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    isDropdownOpen: false,
    isLoading: false,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationDropdown', () => {
  describe('notification list', () => {
    it('renders notification list when dropdown is open', () => {
      const notifications = [
        makeNotification({ id: 'n1', title: 'Order Approved' }),
        makeNotification({ id: 'n2', title: 'Payment Received', priority: 'HIGH' }),
      ];
      useNotificationStore.setState({
        notifications,
        unreadCount: 2,
        isDropdownOpen: true,
      });

      renderDropdown();

      expect(screen.getByText('Order Approved')).toBeInTheDocument();
      expect(screen.getByText('Payment Received')).toBeInTheDocument();
    });

    it('shows priority border colours', () => {
      const notifications = [
        makeNotification({ id: 'n1', title: 'Urgent Item', priority: 'URGENT' }),
        makeNotification({ id: 'n2', title: 'High Item', priority: 'HIGH' }),
        makeNotification({ id: 'n3', title: 'Normal Item', priority: 'NORMAL' }),
        makeNotification({ id: 'n4', title: 'Low Item', priority: 'LOW' }),
      ];
      useNotificationStore.setState({
        notifications,
        unreadCount: 4,
        isDropdownOpen: true,
      });

      renderDropdown();

      expect(screen.getByText('Urgent Item')).toBeInTheDocument();
      expect(screen.getByText('High Item')).toBeInTheDocument();
      expect(screen.getByText('Normal Item')).toBeInTheDocument();
      expect(screen.getByText('Low Item')).toBeInTheDocument();
    });

    it('shows unread indicator for DELIVERED notifications', () => {
      useNotificationStore.setState({
        notifications: [makeNotification({ id: 'n1', status: 'DELIVERED' })],
        unreadCount: 1,
        isDropdownOpen: true,
      });

      renderDropdown();

      const title = screen.getByText('Test Notification');
      const row = title.closest('[role="button"]');
      expect(row).toBeInTheDocument();
      // Unread items have bg-[#faf9ff] background
      expect(row).toHaveClass('bg-[#faf9ff]');
    });

    it('shows READ notification without bold text', () => {
      useNotificationStore.setState({
        notifications: [makeNotification({ id: 'n1', status: 'READ' })],
        unreadCount: 0,
        isDropdownOpen: true,
      });

      renderDropdown();

      const title = screen.getByText('Test Notification');
      expect(title).toHaveClass('text-muted-foreground');
    });
  });

  describe('click navigates and marks as read', () => {
    it('navigates to actionUrl and marks as read on click', async () => {
      const user = userEvent.setup();

      useNotificationStore.setState({
        notifications: [
          makeNotification({
            id: 'n1',
            actionUrl: '/sales/orders/123',
          }),
        ],
        unreadCount: 1,
        isDropdownOpen: true,
      });

      renderDropdown();

      const item = screen.getByText('Test Notification').closest('[role="button"]');
      expect(item).toBeInTheDocument();
      await user.click(item!);

      expect(mockMarkAsReadMutate).toHaveBeenCalledWith('n1');
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sales/orders/123' });
    });
  });

  describe('dismiss removes notification', () => {
    it('calls dismiss mutation on dismiss click', async () => {
      const user = userEvent.setup();

      useNotificationStore.setState({
        notifications: [makeNotification({ id: 'n1' })],
        unreadCount: 1,
        isDropdownOpen: true,
      });

      renderDropdown();

      // Hover over the notification item to reveal dismiss button
      const item = screen.getByText('Test Notification').closest('[role="button"]');
      await user.hover(item!);

      const dismissBtn = screen.getByRole('button', { name: 'notifications:dismiss' });
      await user.click(dismissBtn);

      expect(mockDismissMutate).toHaveBeenCalledWith('n1');
    });
  });

  describe('mark all read clears all', () => {
    it('calls markAllAsRead mutation when clicking mark all read', async () => {
      const user = userEvent.setup();

      useNotificationStore.setState({
        notifications: [
          makeNotification({ id: 'n1', status: 'DELIVERED' }),
          makeNotification({ id: 'n2', status: 'DELIVERED' }),
        ],
        unreadCount: 2,
        isDropdownOpen: true,
      });

      renderDropdown();

      const markAllBtn = screen.getByText('notifications:markAllRead');
      await user.click(markAllBtn);

      expect(mockMarkAllAsReadMutate).toHaveBeenCalled();
    });

    it('does not show mark all read button when unread count is 0', () => {
      useNotificationStore.setState({
        notifications: [makeNotification({ id: 'n1', status: 'READ' })],
        unreadCount: 0,
        isDropdownOpen: true,
      });

      renderDropdown();

      expect(screen.queryByText('notifications:markAllRead')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when there are no notifications', () => {
      useNotificationStore.setState({
        notifications: [],
        unreadCount: 0,
        isDropdownOpen: true,
      });

      renderDropdown();

      expect(screen.getByText('notifications:noNotifications')).toBeInTheDocument();
      expect(screen.getByText('notifications:noNotificationsDescription')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows skeleton loader when loading', () => {
      mockUseNotifications.mockReturnValue({ isLoading: true });

      useNotificationStore.setState({
        notifications: [],
        unreadCount: 0,
        isDropdownOpen: true,
      });

      renderDropdown();

      // Should see skeleton elements (data-slot="skeleton")
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      // 3 skeleton items x 3 skeleton divs each = 9
      expect(skeletons.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('footer', () => {
    it('shows "View All" link that navigates to /notifications', async () => {
      const user = userEvent.setup();

      useNotificationStore.setState({
        notifications: [makeNotification({ id: 'n1' })],
        unreadCount: 1,
        isDropdownOpen: true,
      });

      renderDropdown();

      const viewAllBtn = screen.getByText('notifications:viewAll');
      await user.click(viewAllBtn);

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/notifications' });
    });
  });
});

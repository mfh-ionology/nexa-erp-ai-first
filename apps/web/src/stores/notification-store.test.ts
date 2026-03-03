import { describe, it, expect, beforeEach } from 'vitest';

import { useNotificationStore, type Notification } from './notification-store';

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif-1',
  title: 'Invoice Approved',
  body: 'Invoice INV-0042 has been approved.',
  priority: 'NORMAL',
  actionUrl: '/ar/invoices/inv-0042',
  entityType: 'customerInvoice',
  entityId: 'inv-0042',
  status: 'DELIVERED',
  createdAt: '2026-03-03T10:00:00Z',
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isDropdownOpen: false,
      isLoading: false,
    });
  });

  describe('setNotifications', () => {
    it('replaces the notification list', () => {
      const notifications = [makeNotification({ id: 'n-1' }), makeNotification({ id: 'n-2' })];
      useNotificationStore.getState().setNotifications(notifications);
      expect(useNotificationStore.getState().notifications).toEqual(notifications);
    });

    it('clears notifications when given empty array', () => {
      useNotificationStore.setState({
        notifications: [makeNotification()],
      });
      useNotificationStore.getState().setNotifications([]);
      expect(useNotificationStore.getState().notifications).toEqual([]);
    });
  });

  describe('prependNotification', () => {
    it('adds notification to the top of the list', () => {
      const existing = makeNotification({ id: 'n-1', title: 'Old' });
      useNotificationStore.setState({ notifications: [existing] });

      const newNotif = makeNotification({ id: 'n-2', title: 'New' });
      useNotificationStore.getState().prependNotification(newNotif);

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(2);
      expect(notifications[0]?.id).toBe('n-2');
      expect(notifications[1]?.id).toBe('n-1');
    });

    it('works on empty list', () => {
      const notif = makeNotification();
      useNotificationStore.getState().prependNotification(notif);
      expect(useNotificationStore.getState().notifications).toEqual([notif]);
    });
  });

  describe('setUnreadCount', () => {
    it('updates the unread count', () => {
      useNotificationStore.getState().setUnreadCount(5);
      expect(useNotificationStore.getState().unreadCount).toBe(5);
    });

    it('sets count to 0', () => {
      useNotificationStore.setState({ unreadCount: 3 });
      useNotificationStore.getState().setUnreadCount(0);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('sets status to READ for a DELIVERED notification', () => {
      const notif = makeNotification({ id: 'n-1', status: 'DELIVERED' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 1 });

      useNotificationStore.getState().markAsRead('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0]?.status).toBe('READ');
      expect(state.unreadCount).toBe(0);
    });

    it('no-ops for a PENDING notification (only DELIVERED → READ is valid)', () => {
      const notif = makeNotification({ id: 'n-1', status: 'PENDING' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 1 });

      useNotificationStore.getState().markAsRead('n-1');

      expect(useNotificationStore.getState().notifications[0]?.status).toBe('PENDING');
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('does not change already READ notifications', () => {
      const notif = makeNotification({ id: 'n-1', status: 'READ' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });

      useNotificationStore.getState().markAsRead('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('does not change DISMISSED notifications', () => {
      const notif = makeNotification({ id: 'n-1', status: 'DISMISSED' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });

      useNotificationStore.getState().markAsRead('n-1');

      expect(useNotificationStore.getState().notifications[0]?.status).toBe('DISMISSED');
    });

    it('does not affect other notifications', () => {
      const n1 = makeNotification({ id: 'n-1', status: 'DELIVERED' });
      const n2 = makeNotification({ id: 'n-2', status: 'DELIVERED' });
      useNotificationStore.setState({ notifications: [n1, n2], unreadCount: 2 });

      useNotificationStore.getState().markAsRead('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0]?.status).toBe('READ');
      expect(state.notifications[1]?.status).toBe('DELIVERED');
      expect(state.unreadCount).toBe(1);
    });

    it('does not decrement below 0', () => {
      const notif = makeNotification({ id: 'n-1', status: 'DELIVERED' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });

      useNotificationStore.getState().markAsRead('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('no-ops for non-existent notification id', () => {
      const notif = makeNotification({ id: 'n-1', status: 'DELIVERED' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 1 });

      useNotificationStore.getState().markAsRead('non-existent');

      expect(useNotificationStore.getState().unreadCount).toBe(1);
      expect(useNotificationStore.getState().notifications[0]?.status).toBe('DELIVERED');
    });
  });

  describe('markAsDismissed', () => {
    it('removes the notification from the list', () => {
      const notif = makeNotification({ id: 'n-1', status: 'DELIVERED' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 1 });

      useNotificationStore.getState().markAsDismissed('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });

    it('decrements unread count for unread notification', () => {
      const n1 = makeNotification({ id: 'n-1', status: 'DELIVERED' });
      const n2 = makeNotification({ id: 'n-2', status: 'DELIVERED' });
      useNotificationStore.setState({ notifications: [n1, n2], unreadCount: 2 });

      useNotificationStore.getState().markAsDismissed('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(1);
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it('no-ops for already-read notification (only DELIVERED → DISMISSED is valid)', () => {
      const notif = makeNotification({ id: 'n-1', status: 'READ' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });

      useNotificationStore.getState().markAsDismissed('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it('no-ops for PENDING notification (only DELIVERED → DISMISSED is valid)', () => {
      const notif = makeNotification({ id: 'n-1', status: 'PENDING' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 0 });

      useNotificationStore.getState().markAsDismissed('n-1');

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it('no-ops for non-existent notification id', () => {
      const notif = makeNotification({ id: 'n-1' });
      useNotificationStore.setState({ notifications: [notif], unreadCount: 1 });

      useNotificationStore.getState().markAsDismissed('non-existent');

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('sets DELIVERED notifications to READ, leaves PENDING unchanged', () => {
      const notifications = [
        makeNotification({ id: 'n-1', status: 'DELIVERED' }),
        makeNotification({ id: 'n-2', status: 'PENDING' }),
        makeNotification({ id: 'n-3', status: 'READ' }),
      ];
      useNotificationStore.setState({ notifications, unreadCount: 2 });

      useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications[0]?.status).toBe('READ');
      // PENDING stays PENDING — only DELIVERED → READ is valid per §17.2
      expect(state.notifications[1]?.status).toBe('PENDING');
      expect(state.notifications[2]?.status).toBe('READ');
      // PENDING items still count as unread
      expect(state.unreadCount).toBe(1);
    });

    it('does not change DISMISSED notifications', () => {
      const notifications = [
        makeNotification({ id: 'n-1', status: 'DELIVERED' }),
        makeNotification({ id: 'n-2', status: 'DISMISSED' }),
      ];
      useNotificationStore.setState({ notifications, unreadCount: 1 });

      useNotificationStore.getState().markAllAsRead();

      expect(useNotificationStore.getState().notifications[1]?.status).toBe('DISMISSED');
    });

    it('handles empty list', () => {
      useNotificationStore.getState().markAllAsRead();
      expect(useNotificationStore.getState().unreadCount).toBe(0);
      expect(useNotificationStore.getState().notifications).toEqual([]);
    });
  });

  describe('toggleDropdown', () => {
    it('opens when closed', () => {
      useNotificationStore.getState().toggleDropdown();
      expect(useNotificationStore.getState().isDropdownOpen).toBe(true);
    });

    it('closes when open', () => {
      useNotificationStore.setState({ isDropdownOpen: true });
      useNotificationStore.getState().toggleDropdown();
      expect(useNotificationStore.getState().isDropdownOpen).toBe(false);
    });
  });

  describe('closeDropdown', () => {
    it('closes the dropdown', () => {
      useNotificationStore.setState({ isDropdownOpen: true });
      useNotificationStore.getState().closeDropdown();
      expect(useNotificationStore.getState().isDropdownOpen).toBe(false);
    });

    it('no-ops when already closed', () => {
      useNotificationStore.getState().closeDropdown();
      expect(useNotificationStore.getState().isDropdownOpen).toBe(false);
    });
  });
});

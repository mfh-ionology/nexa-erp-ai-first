import { create } from 'zustand';

// ── Notification types (aligned with WebSocket contract from E9-2) ──

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'READ' | 'DISMISSED' | 'FAILED';

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  status: NotificationStatus;
  createdAt: string; // ISO 8601
}

// ── Store interface ──────────────────────────────────────────────────────────

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isDropdownOpen: boolean;
  isLoading: boolean;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  prependNotification: (notification: Notification) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: (notificationId: string) => void;
  markAsDismissed: (notificationId: string) => void;
  markAllAsRead: () => void;
  setDropdownOpen: (open: boolean) => void;
  toggleDropdown: () => void;
  closeDropdown: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  isDropdownOpen: false,
  isLoading: false,

  setNotifications: (notifications) => set({ notifications }),

  prependNotification: (notification) =>
    set((s) => {
      // Guard against duplicates (WebSocket reconnection replays, server retries)
      if (s.notifications.some((n) => n.id === notification.id)) {
        return s;
      }
      // New notifications from WebSocket are DELIVERED (unread) — increment count
      const isUnread = notification.status === 'PENDING' || notification.status === 'DELIVERED';
      // Cap list at 50 items to prevent unbounded memory growth
      const updated = [notification, ...s.notifications];
      if (updated.length > 50) {
        updated.length = 50;
      }
      return {
        notifications: updated,
        unreadCount: isUnread ? s.unreadCount + 1 : s.unreadCount,
      };
    }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  markAsRead: (notificationId) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === notificationId);
      // State machine §17.2: only DELIVERED → READ is valid
      if (!target || target.status !== 'DELIVERED') {
        return s;
      }
      return {
        notifications: s.notifications.map((n) =>
          n.id === notificationId ? { ...n, status: 'READ' as NotificationStatus } : n,
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      };
    }),

  markAsDismissed: (notificationId) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === notificationId);
      // State machine §17.2: only DELIVERED → DISMISSED is valid
      if (!target || target.status !== 'DELIVERED') return s;
      return {
        notifications: s.notifications.filter((n) => n.id !== notificationId),
        unreadCount: Math.max(0, s.unreadCount - 1),
      };
    }),

  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        // State machine §17.2: only DELIVERED → READ is valid
        n.status === 'DELIVERED' ? { ...n, status: 'READ' as NotificationStatus } : n,
      ),
      // Recalculate: only PENDING items remain unread (DELIVERED ones just became READ)
      unreadCount: s.notifications.filter((n) => n.status === 'PENDING').length,
    })),

  setDropdownOpen: (open) => set({ isDropdownOpen: open }),

  toggleDropdown: () => set((s) => ({ isDropdownOpen: !s.isDropdownOpen })),

  closeDropdown: () => set({ isDropdownOpen: false }),
}));
